import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { storage } from '@/src/utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../services/api';

interface AuthContextType {
  masterPassword: string | null;
  isAuthenticated: boolean;
  isSetup: boolean;
  isCheckingSetup: boolean;
  isBiometricEnabled: boolean;
  userEmail: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setupMasterPassword: (email: string, password: string) => Promise<void>;
  checkSetup: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const biometricAuthInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    await checkSetup();
    await restoreSession();
    await checkBiometricEnabled();
    setIsCheckingSetup(false);
  };

  const restoreSession = async () => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const email = sessionStorage.getItem('pm_user_email') || '';
      const password = sessionStorage.getItem('pm_master_password') || '';
      if (email && password) {
        await api.login(email, password);
        setMasterPassword(password);
        setUserEmail(email);
        setIsAuthenticated(true);
      } else if (email) {
        setUserEmail(email);
      }
    } catch (error) {
      console.error('Session restore failed:', error);
      try {
        sessionStorage.removeItem('pm_master_password');
      } catch (_) {}
    }
  };

  const persistSession = (email: string, password: string) => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem('pm_user_email', email);
      sessionStorage.setItem('pm_master_password', password);
    } catch (_) {}
  };

  const clearSession = () => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem('pm_master_password');
      // keep email for login prefills
    } catch (_) {}
  };

  const checkSetup = async () => {
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await api.checkSetup();
        setIsSetup(result.is_setup);
        // Do not prefill from API (checkSetup returns no email for multi-user).
        // Login prefill comes only from sessionStorage / previous login on this device.
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    console.error('Error checking setup after retries:', lastError);
  };

  const checkBiometricEnabled = async () => {
    try {
      const enabled = await storage.getItem('biometric_enabled', 'false');
      setIsBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking biometric:', error);
    }
  };

  const setupMasterPassword = async (email: string, password: string) => {
    try {
      await api.setupMasterPassword(email, password);
      setMasterPassword(password);
      setUserEmail(email);
      setIsAuthenticated(true);
      setIsSetup(true);
      persistSession(email, password);
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await api.login(email, password);
      setMasterPassword(password);
      setUserEmail(email);
      setIsAuthenticated(true);
      persistSession(email, password);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setMasterPassword(null);
    setIsAuthenticated(false);
    clearSession();
  };

  const resetAllData = async () => {
    try {
      await api.resetAllData();
      // Clear all local state
      setMasterPassword(null);
      setIsAuthenticated(false);
      setIsSetup(false);
      setIsBiometricEnabled(false);
      clearSession();
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('pm_user_email');
        }
      } catch (_) {}
      // Clear secure storage
      try {
        await storage.setItem('biometric_enabled', 'false');
        await storage.secureSet('master_password', '');
      } catch (e) {
        console.error('Error clearing storage:', e);
      }
    } catch (error) {
      throw error;
    }
  };

  const enableBiometric = async () => {
    if (!masterPassword || !userEmail) {
      throw new Error('Accedi prima di abilitare la biometrica');
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      await storage.secureSet('master_password', masterPassword);
      await storage.secureSet('user_email', userEmail);
      await storage.setItem('biometric_enabled', 'true');
      setIsBiometricEnabled(true);
      return;
    }

    // PC / browser: Windows Hello / platform WebAuthn
    const { isWebPlatformAuthAvailable, registerWebPlatformAuth } = await import(
      '@/src/utils/webBiometric'
    );
    if (await isWebPlatformAuthAvailable()) {
      await registerWebPlatformAuth(userEmail);
      await storage.secureSet('master_password', masterPassword);
      await storage.secureSet('user_email', userEmail);
      await storage.setItem('biometric_enabled', 'true');
      setIsBiometricEnabled(true);
      return;
    }

    throw new Error(
      'Biometrica non disponibile. Su PC serve Windows Hello (o Touch ID) nel browser.',
    );
  };

  const disableBiometric = async () => {
    await storage.secureSet('master_password', '');
    await storage.secureSet('user_email', '');
    await storage.setItem('biometric_enabled', 'false');
    setIsBiometricEnabled(false);
    try {
      const { clearWebPlatformAuth } = await import('@/src/utils/webBiometric');
      clearWebPlatformAuth();
    } catch (_) {}
  };

  const authenticateWithBiometric = async () => {
    // Dedupe concurrent prompts (e.g. Strict Mode / overlapping Login effects).
    if (biometricAuthInFlight.current) {
      return biometricAuthInFlight.current;
    }

    const authPromise = (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      let verified = false;

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Sblocca Password Manager',
          fallbackLabel: 'Usa Password Master',
        });
        verified = result.success;
      } else {
        const { authenticateWebPlatformAuth } = await import('@/src/utils/webBiometric');
        verified = await authenticateWebPlatformAuth();
      }

      if (!verified) {
        throw new Error('Autenticazione biometrica fallita o annullata');
      }

      const savedPassword = await storage.secureGet('master_password', null);
      const savedEmail = await storage.secureGet('user_email', null);
      if (savedPassword && savedEmail) {
        try {
          await login(savedEmail, savedPassword);
        } catch (error) {
          await storage.secureSet('master_password', '');
          await storage.secureSet('user_email', '');
          await storage.setItem('biometric_enabled', 'false');
          setIsBiometricEnabled(false);
          try {
            const { clearWebPlatformAuth } = await import('@/src/utils/webBiometric');
            clearWebPlatformAuth();
          } catch (_) {}
          throw new Error(
            'La password è stata cambiata. Accedi con la nuova password master e ri-abilita la biometrica.',
          );
        }
      } else {
        await storage.setItem('biometric_enabled', 'false');
        setIsBiometricEnabled(false);
        throw new Error('Nessuna credenziale salvata. Accedi con la password master.');
      }
    })();

    biometricAuthInFlight.current = authPromise;
    try {
      await authPromise;
    } finally {
      if (biometricAuthInFlight.current === authPromise) {
        biometricAuthInFlight.current = null;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        masterPassword,
        isAuthenticated,
        isSetup,
        isCheckingSetup,
        isBiometricEnabled,
        userEmail,
        login,
        logout,
        setupMasterPassword,
        checkSetup,
        enableBiometric,
        disableBiometric,
        authenticateWithBiometric,
        resetAllData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

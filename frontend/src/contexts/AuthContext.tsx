import React, { createContext, useContext, useState, useEffect } from 'react';
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
  login: (password: string) => Promise<void>;
  logout: () => void;
  setupMasterPassword: (email: string, password: string) => Promise<void>;
  checkSetup: () => Promise<void>;
  enableBiometric: () => Promise<void>;
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

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    await checkSetup();
    await checkBiometricEnabled();
    setIsCheckingSetup(false);
  };

  const checkSetup = async () => {
    // Retry logic to handle React 19 StrictMode double-mount fetch aborts
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await api.checkSetup();
        setIsSetup(result.is_setup);
        setUserEmail(result.email || '');
        return;
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 300));
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
    } catch (error) {
      throw error;
    }
  };

  const login = async (password: string) => {
    try {
      await api.login(password);
      setMasterPassword(password);
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setMasterPassword(null);
    setIsAuthenticated(false);
  };

  const resetAllData = async () => {
    try {
      await api.resetAllData();
      // Clear all local state
      setMasterPassword(null);
      setIsAuthenticated(false);
      setIsSetup(false);
      setIsBiometricEnabled(false);
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
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled && masterPassword) {
      await storage.secureSet('master_password', masterPassword);
      await storage.setItem('biometric_enabled', 'true');
      setIsBiometricEnabled(true);
    } else {
      throw new Error('Biometric authentication not available');
    }
  };

  const authenticateWithBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access your passwords',
      fallbackLabel: 'Use Master Password'
    });

    if (result.success) {
      const savedPassword = await storage.secureGet('master_password', null);
      if (savedPassword) {
        try {
          await login(savedPassword);
        } catch (error) {
          // Saved password is no longer valid (e.g. after password reset)
          // Disable biometric authentication and clear stored password
          await storage.secureSet('master_password', '');
          await storage.setItem('biometric_enabled', 'false');
          setIsBiometricEnabled(false);
          throw new Error('La password è stata cambiata. Accedi con la nuova password master e ri-abilita la biometrica.');
        }
      } else {
        // No saved password - disable biometric
        await storage.setItem('biometric_enabled', 'false');
        setIsBiometricEnabled(false);
        throw new Error('Nessuna password salvata. Accedi con la password master.');
      }
    } else {
      throw new Error('Biometric authentication failed');
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

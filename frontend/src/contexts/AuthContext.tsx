import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '@/src/utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../services/api';

interface AuthContextType {
  masterPassword: string | null;
  isAuthenticated: boolean;
  isSetup: boolean;
  isBiometricEnabled: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
  setupMasterPassword: (password: string) => Promise<void>;
  checkSetup: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  useEffect(() => {
    checkSetup();
    checkBiometricEnabled();
  }, []);

  const checkSetup = async () => {
    try {
      const result = await api.checkSetup();
      setIsSetup(result.is_setup);
    } catch (error) {
      console.error('Error checking setup:', error);
    }
  };

  const checkBiometricEnabled = async () => {
    const enabled = await storage.getItem('biometric_enabled', 'false');
    setIsBiometricEnabled(enabled === 'true');
  };

  const setupMasterPassword = async (password: string) => {
    try {
      await api.setupMasterPassword(password);
      setMasterPassword(password);
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
        await login(savedPassword);
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
        isBiometricEnabled,
        login,
        logout,
        setupMasterPassword,
        checkSetup,
        enableBiometric,
        authenticateWithBiometric
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

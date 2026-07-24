import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { login, isBiometricEnabled, authenticateWithBiometric, resetAllData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled && isBiometricEnabled);

    // Auto-trigger biometric if available
    if (hasHardware && isEnrolled && isBiometricEnabled) {
      handleBiometricLogin();
    }
  };

  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Errore', 'Inserisci la password master');
      return;
    }

    try {
      await login(password);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Errore', 'Password master non valida');
    }
  };

  const handleBiometricLogin = async () => {
    try {
      await authenticateWithBiometric();
      router.replace('/home');
    } catch (error: any) {
      console.log('Biometric auth failed:', error);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAllData();
      setShowResetModal(false);
      setPassword('');
      // Redirect to setup screen
      router.replace('/setup');
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Reset fallito');
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={80} color="#4ecdc4" />
          </View>

          <Text style={styles.title}>Password Manager</Text>
          <Text style={styles.subtitle}>Inserisci la tua password master</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="key" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="master-password-input"
              style={styles.input}
              placeholder="Password Master"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} activeOpacity={0.6}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity testID="login-button" style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Accedi</Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <TouchableOpacity
              testID="biometric-login-button"
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
            >
              <Ionicons name="finger-print" size={24} color="#4ecdc4" />
              <Text style={styles.biometricText}>Usa Biometrica</Text>
            </TouchableOpacity>
          )}

          {/* Forgot Password / Reset */}
          <TouchableOpacity
            testID="forgot-password-button"
            style={styles.forgotButton}
            onPress={() => setShowResetModal(true)}
          >
            <Text style={styles.forgotText}>Password dimenticata? Reset</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning" size={48} color="#ff6b6b" />
            </View>
            <Text style={styles.modalTitle}>Attenzione!</Text>
            <Text style={styles.modalText}>
              Questa azione cancellerà{'\n'}
              <Text style={styles.bold}>TUTTE le tue password</Text>{'\n'}
              e la password master.{'\n\n'}
              L'azione è irreversibile.
            </Text>

            <TouchableOpacity
              testID="confirm-reset-button"
              style={styles.dangerButton}
              onPress={handleReset}
              disabled={resetting}
            >
              <Text style={styles.dangerButtonText}>
                {resetting ? 'Cancellazione...' : 'Sì, cancella tutto'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="cancel-reset-button"
              style={styles.cancelButton}
              onPress={() => setShowResetModal(false)}
              disabled={resetting}
            >
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 16,
  },
  biometricText: {
    color: '#4ecdc4',
    fontSize: 16,
    marginLeft: 8,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  forgotText: {
    color: '#ff6b6b',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
    color: '#ff6b6b',
  },
  dangerButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ecdc4',
  },
  cancelButtonText: {
    color: '#4ecdc4',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

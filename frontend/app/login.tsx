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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { login, isBiometricEnabled, authenticateWithBiometric } = useAuth();
  const router = useRouter();

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled && isBiometricEnabled);

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
      // Show message if password was changed
      if (error.message && (error.message.includes('cambiata') || error.message.includes('salvata'))) {
        Alert.alert('Biometrica Disabilitata', error.message);
        // Re-check biometric availability (will be false now)
        setBiometricAvailable(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6}
            >
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

          {/* Forgot Password Link */}
          <TouchableOpacity
            testID="forgot-password-button"
            style={styles.forgotButton}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.forgotText}>Password dimenticata?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    color: '#4ecdc4',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

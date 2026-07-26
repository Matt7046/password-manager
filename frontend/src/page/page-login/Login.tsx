import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { showAlert } from '@/src/utils/alert';
import { styles } from './Login.styles';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { login, isBiometricEnabled, authenticateWithBiometric, userEmail } = useAuth();
  const router = useRouter();

  useEffect(() => {
    checkBiometric();
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    let webOk = false;
    if (Platform.OS === 'web') {
      try {
        const { isWebPlatformAuthAvailable } = await import('@/src/utils/webBiometric');
        webOk = await isWebPlatformAuthAvailable();
      } catch (_) {}
    }
    const canUse = ((hasHardware && isEnrolled) || webOk) && isBiometricEnabled;
    setBiometricAvailable(canUse);

    if (canUse) {
      handleBiometricLogin();
    }
  };

  const validateEmail = (value: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      showAlert('Errore', 'Inserisci il tuo indirizzo email');
      return;
    }

    if (!validateEmail(email)) {
      showAlert('Errore', 'Inserisci un indirizzo email valido');
      return;
    }

    if (!password) {
      showAlert('Errore', 'Inserisci la password master');
      return;
    }

    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/home');
    } catch (error: any) {
      showAlert('Errore', error?.message || 'Email o password non validi');
    }
  };

  const handleBiometricLogin = async () => {
    try {
      await authenticateWithBiometric();
      router.replace('/home');
    } catch (error: any) {
      console.log('Biometric auth failed:', error);
      if (error.message && (error.message.includes('cambiata') || error.message.includes('salvata'))) {
        showAlert('Biometrica Disabilitata', error.message);
        setBiometricAvailable(false);
      }
    }
  };

  const handleCreateAccount = () => {
    router.push('/setup');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={80} color="#4ecdc4" />
          </View>

          <Text style={styles.title}>Password Manager</Text>
          <Text style={styles.subtitle}>Accedi al tuo account</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="login-email-input"
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

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

          <TouchableOpacity
            testID="forgot-password-button"
            style={styles.forgotButton}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.forgotText}>Password dimenticata?</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            testID="create-account-button"
            style={styles.createAccountButton}
            onPress={handleCreateAccount}
          >
            <Ionicons name="person-add" size={20} color="#4ecdc4" />
            <Text style={styles.createAccountText}>Crea nuovo account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

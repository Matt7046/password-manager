import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './ForgotPassword.styles';

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendOTP = async () => {
    if (!email.trim() || !validateEmail(email)) {
      Alert.alert('Errore', 'Inserisci un indirizzo email valido');
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      Alert.alert(
        'Codice Inviato',
        `Un codice a 6 cifre è stato inviato a ${email}. Controlla anche lo spam.`,
      );
      setStep('otp');
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Impossibile inviare il codice');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Errore', 'Il codice deve essere di 6 cifre');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'Le password non corrispondono');
      return;
    }

    setLoading(true);
    try {
      await api.verifyOTPReset(email.trim().toLowerCase(), otpCode, newPassword);
      Alert.alert(
        'Password Resettata',
        'Ora puoi accedere con la nuova password master.',
      );
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Reset fallito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-open" size={80} color="#4ecdc4" />
          </View>

          {step === 'email' ? (
            <>
              <Text style={styles.title}>Reset via Email</Text>
              <Text style={styles.subtitle}>
                Inserisci l&apos;email di registrazione per ricevere il codice di reset
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  testID="forgot-email-input"
                  style={styles.input}
                  placeholder="Email di registrazione"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <TouchableOpacity
                testID="send-otp-button"
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a1a2e" />
                ) : (
                  <Text style={styles.buttonText}>Invia Codice</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.warning}>
                ✓ Le password salvate saranno preservate dopo il reset.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Inserisci Codice</Text>
              <Text style={styles.subtitle}>
                Codice inviato a{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons name="keypad" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  testID="otp-input"
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#666"
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  testID="new-password-input"
                  style={styles.input}
                  placeholder="Nuova Password Master"
                  placeholderTextColor="#666"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  activeOpacity={0.6}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  testID="confirm-new-password-input"
                  style={styles.input}
                  placeholder="Conferma Password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                testID="verify-otp-button"
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a1a2e" />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendButton} onPress={() => setStep('email')}>
                <Text style={styles.resendText}>Cambia email / Invia di nuovo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import React, { useState } from 'react';
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
import { showAlert } from '@/src/utils/alert';
import { styles } from './Setup.styles';

export default function Setup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const { setupMasterPassword } = useAuth();
  const router = useRouter();

  const validateEmail = (value: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const handleSetup = async () => {
    setErrorText('');

    if (!email.trim()) {
      setErrorText('Inserisci il tuo indirizzo email');
      showAlert('Errore', 'Inserisci il tuo indirizzo email');
      return;
    }

    if (!validateEmail(email)) {
      setErrorText('Inserisci un indirizzo email valido');
      showAlert('Errore', 'Inserisci un indirizzo email valido');
      return;
    }

    if (password.length < 6) {
      setErrorText('La password deve essere di almeno 6 caratteri');
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Le password non corrispondono');
      showAlert('Errore', 'Le password non corrispondono');
      return;
    }

    setLoading(true);
    try {
      await setupMasterPassword(email.trim().toLowerCase(), password);
      router.replace('/home');
    } catch (error: any) {
      const msg = error.message || 'Setup fallito';
      setErrorText(msg);
      showAlert('Errore', msg);
    } finally {
      setLoading(false);
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
            <Ionicons name="shield-checkmark" size={80} color="#4ecdc4" />
          </View>

          <Text style={styles.title}>Nuovo account</Text>
          <Text style={styles.subtitle}>
            Crea un vault con la tua email. Ogni account ha le proprie password.
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="setup-email-input"
              style={styles.input}
              placeholder="Email (per reset password)"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="setup-password-input"
              style={styles.input}
              placeholder="Password Master"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
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

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="setup-confirm-password-input"
              style={styles.input}
              placeholder="Conferma Password"
              placeholderTextColor="#666"
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6}
            >
              <Ionicons
                name={showConfirm ? 'eye-off' : 'eye'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <TouchableOpacity
            testID="setup-submit-button"
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSetup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creazione...' : 'Crea Account'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.warning}>
            ⚠️ Ricorda la password! L&apos;email servirà per il reset se la dimentichi.
          </Text>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
            <Text style={styles.loginLinkText}>Hai già un account? Accedi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

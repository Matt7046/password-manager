import React, { useState } from 'react';
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

export default function SetupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setupMasterPassword } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSetup = async () => {
    if (!email.trim()) {
      Alert.alert('Errore', 'Inserisci il tuo indirizzo email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Errore', 'Inserisci un indirizzo email valido');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Errore', 'Le password non corrispondono');
      return;
    }

    setLoading(true);
    try {
      await setupMasterPassword(email.trim().toLowerCase(), password);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Setup fallito');
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

          <Text style={styles.title}>Benvenuto</Text>
          <Text style={styles.subtitle}>
            Crea il tuo account per iniziare
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warning: {
    color: '#ffa500',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
    lineHeight: 20,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './EditPassword.styles';

export default function EditPassword() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<PasswordEntry | null>(null);
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Altro');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const { id } = useLocalSearchParams();
  const { masterPassword, userEmail } = useAuth();
  const router = useRouter();

  const categories = [
    'Social Media',
    'Email',
    'Banca',
    'Acquisti',
    'Lavoro',
    'Intrattenimento',
    'Videogiochi',
    'Viaggi',
    'Istruzione',
    'Salute',
    'Altro',
  ];

  useEffect(() => {
    loadPassword();
  }, []);

  const loadPassword = async () => {
    try {
      const passwords = await api.getAllPasswords(userEmail, masterPassword!);
      const found = passwords.find(p => p.id === id);
      if (found) {
        setEntry(found);
        setAccountName(found.account_name);
        setUsername(found.username);
        setPassword(found.password);
        setUrl(found.url || '');
        setNotes(found.notes || '');
        setCategory(found.category);
        setTags(found.tags || []);
      } else {
        Alert.alert('Errore', 'Password non trovata');
        router.back();
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare la password');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    const next = tagInput.trim();
    if (!next) {
      return;
    }
    if (tags.includes(next)) {
      setTagInput('');
      return;
    }
    setTags([...tags, next]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      Alert.alert('Errore', 'Inserisci il nome dell\'account');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Errore', 'Inserisci username o email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Errore', 'Inserisci la password');
      return;
    }

    setSaving(true);
    try {
      await api.updatePassword(id as string, {
        account_name: accountName,
        username: username,
        password: password,
        url: url,
        notes: notes,
        category: category,
        tags: tags,
        email: userEmail,
        master_password: masterPassword,
      });
      // Redirect immediately without Alert callback (works reliably on web/mobile)
      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Impossibile aggiornare la password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ecdc4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifica Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome Account *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-circle" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="es. Facebook, Gmail, Amazon"
              placeholderTextColor="#666"
              value={accountName}
              onChangeText={setAccountName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username / Email *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="username o email"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} activeOpacity={0.6}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>URL / Sito Web</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="globe" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#666"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <Ionicons name="folder" size={20} color="#4ecdc4" />
            <Text style={styles.categoryButtonText}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color="#4ecdc4" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tag</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Aggiungi tag"
              placeholderTextColor="#666"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
              blurOnSubmit={false}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Enter') {
                  e.preventDefault?.();
                  handleAddTag();
                }
              }}
            />
            <TouchableOpacity
              onPress={handleAddTag}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Aggiungi tag"
            >
              <Ionicons name="add-circle" size={24} color="#4ecdc4" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                    <Ionicons name="close" size={16} color="#1a1a2e" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Note</Text>
          <View style={[styles.inputContainer, styles.textAreaContainer]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Note aggiuntive..."
              placeholderTextColor="#666"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleziona Categoria</Text>
            <ScrollView>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    category === cat && styles.categoryOptionSelected,
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      category === cat && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark" size={20} color="#4ecdc4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

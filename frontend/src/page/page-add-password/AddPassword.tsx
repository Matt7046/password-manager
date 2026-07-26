import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/src/utils/alert';
import { styles } from './AddPassword.styles';

export default function AddPassword() {
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
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const { masterPassword, userEmail, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !masterPassword) {
      router.replace('/login');
    }
  }, [isAuthenticated, masterPassword]);

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
    setErrorText('');
    if (!masterPassword || !userEmail) {
      showAlert('Errore', 'Sessione scaduta. Accedi di nuovo.');
      router.replace('/login');
      return;
    }
    if (!accountName.trim()) {
      setErrorText('Inserisci il nome dell\'account');
      showAlert('Errore', 'Inserisci il nome dell\'account');
      return;
    }
    if (!username.trim()) {
      setErrorText('Inserisci username o email');
      showAlert('Errore', 'Inserisci username o email');
      return;
    }
    if (!password.trim()) {
      setErrorText('Inserisci la password');
      showAlert('Errore', 'Inserisci la password');
      return;
    }

    setLoading(true);
    try {
      await api.createPassword({
        account_name: accountName.trim(),
        username: username.trim(),
        password: password,
        url: url.trim(),
        notes: notes,
        category: category || 'Altro',
        tags: tags || [],
        email: userEmail.trim().toLowerCase(),
        master_password: masterPassword,
      });
      router.replace('/home');
    } catch (error: any) {
      const msg = error.message || 'Impossibile salvare la password';
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuova Password</Text>
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
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Salvataggio...' : 'Salva Password'}
          </Text>
        </TouchableOpacity>
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
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

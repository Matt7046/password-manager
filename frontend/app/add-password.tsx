import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';

export default function AddPasswordScreen() {
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Other');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { masterPassword } = useAuth();
  const router = useRouter();

  const categories = [
    'Social Media',
    'Email',
    'Banking',
    'Shopping',
    'Work',
    'Entertainment',
    'Gaming',
    'Travel',
    'Education',
    'Health',
    'Other',
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
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

    setLoading(true);
    try {
      await api.createPassword({
        account_name: accountName,
        username: username,
        password: password,
        url: url,
        notes: notes,
        category: category,
        tags: tags,
        master_password: masterPassword,
      });
      Alert.alert('Successo', 'Password salvata', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.message);
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
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
            />
            <TouchableOpacity onPress={handleAddTag}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  textAreaContainer: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 12,
  },
  categoryButtonText: {
    flex: 1,
    color: '#4ecdc4',
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#0f3460',
  },
  categoryOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  categoryOptionTextSelected: {
    color: '#4ecdc4',
    fontWeight: 'bold',
  },
});

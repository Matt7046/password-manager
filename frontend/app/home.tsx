import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function HomeScreen() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [filteredPasswords, setFilteredPasswords] = useState<PasswordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const { masterPassword, logout, isBiometricEnabled, enableBiometric } = useAuth();
  const router = useRouter();

  const categories = ['Tutti', 'Social Media', 'Email', 'Banking', 'Shopping', 'Work', 'Entertainment', 'Gaming', 'Travel', 'Education', 'Health', 'Other'];

  // Reload passwords every time this screen gets focus (after add/edit/delete)
  useFocusEffect(
    useCallback(() => {
      loadPasswords();
    }, [masterPassword])
  );

  useEffect(() => {
    filterPasswords();
  }, [passwords, searchQuery, selectedCategory]);

  const loadPasswords = async () => {
    try {
      const data = await api.getAllPasswords(masterPassword!);
      setPasswords(data);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare le password');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterPasswords = () => {
    let filtered = passwords;

    if (selectedCategory !== 'Tutti') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPasswords(filtered);
  };

  const handleCopyPassword = async (password: string, accountName: string) => {
    await Clipboard.setStringAsync(password);
    Alert.alert('Copiato', `Password di ${accountName} copiata negli appunti`);
  };

  const handleDeletePassword = async (id: string, accountName: string) => {
    Alert.alert(
      'Conferma',
      `Vuoi eliminare la password per ${accountName}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deletePassword(id, masterPassword!);
              await loadPasswords();
              Alert.alert('Successo', 'Password eliminata');
            } catch (error: any) {
              Alert.alert('Errore', error.message);
            }
          },
        },
      ]
    );
  };

  const handleEnableBiometric = async () => {
    try {
      await enableBiometric();
      Alert.alert('Successo', 'Autenticazione biometrica abilitata');
    } catch (error: any) {
      Alert.alert('Errore', error.message);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      'Social Media': 'share-social',
      'Email': 'mail',
      'Banking': 'cash',
      'Shopping': 'cart',
      'Work': 'briefcase',
      'Entertainment': 'film',
      'Gaming': 'game-controller',
      'Travel': 'airplane',
      'Education': 'school',
      'Health': 'fitness',
      'Other': 'ellipsis-horizontal',
    };
    return icons[category] || 'key';
  };

  const renderPasswordItem = ({ item }: { item: PasswordEntry }) => (
    <TouchableOpacity
      style={styles.passwordCard}
      onPress={() => router.push(`/password-detail?id=${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name={getCategoryIcon(item.category)} size={24} color="#4ecdc4" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.accountName}>{item.account_name}</Text>
          <Text style={styles.username}>{item.username}</Text>
          <View style={styles.tagContainer}>
            <Text style={styles.categoryBadge}>{item.category}</Text>
            {item.tags.map((tag, index) => (
              <Text key={index} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCopyPassword(item.password, item.account_name)}
        >
          <Ionicons name="copy" size={20} color="#4ecdc4" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/edit-password?id=${item.id}`)}
        >
          <Ionicons name="create" size={20} color="#ffa500" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeletePassword(item.id, item.account_name)}
        >
          <Ionicons name="trash" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ecdc4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Password Manager</Text>
        <View style={styles.headerActions}>
          {!isBiometricEnabled && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleEnableBiometric}
            >
              <Ionicons name="finger-print" size={24} color="#4ecdc4" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              logout();
              router.replace('/login');
            }}
          >
            <Ionicons name="log-out" size={24} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca per nome account..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Filter */}
      <TouchableOpacity
        style={styles.categorySelector}
        onPress={() => setShowCategoryModal(true)}
      >
        <Ionicons name="filter" size={20} color="#4ecdc4" />
        <Text style={styles.categoryText}>{selectedCategory}</Text>
        <Ionicons name="chevron-down" size={20} color="#4ecdc4" />
      </TouchableOpacity>

      {/* Password List */}
      <FlatList
        data={filteredPasswords}
        renderItem={renderPasswordItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPasswords();
            }}
            tintColor="#4ecdc4"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="lock-open" size={64} color="#666" />
            <Text style={styles.emptyText}>Nessuna password trovata</Text>
            <Text style={styles.emptySubtext}>Aggiungi la tua prima password</Text>
          </View>
        }
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/add-password')}
      >
        <Ionicons name="add" size={32} color="#1a1a2e" />
      </TouchableOpacity>

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
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  selectedCategory === cat && styles.categoryOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCategory(cat);
                  setShowCategoryModal(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    selectedCategory === cat && styles.categoryOptionTextSelected,
                  ]}
                >
                  {cat}
                </Text>
                {selectedCategory === cat && (
                  <Ionicons name="checkmark" size={20} color="#4ecdc4" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryText: {
    flex: 1,
    color: '#4ecdc4',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  passwordCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: '#4ecdc4',
    color: '#1a1a2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tag: {
    color: '#4ecdc4',
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 20,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4ecdc4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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

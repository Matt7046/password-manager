import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { showAlert, showConfirm } from '@/src/utils/alert';
import { styles } from './Home.styles';

export default function Home() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [filteredPasswords, setFilteredPasswords] = useState<PasswordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const { masterPassword, userEmail, logout, isBiometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const router = useRouter();

  const categories = ['Tutti', 'Social Media', 'Email', 'Banca', 'Acquisti', 'Lavoro', 'Intrattenimento', 'Videogiochi', 'Viaggi', 'Istruzione', 'Salute', 'Altro'];

  // Reload passwords every time this screen gets focus (after add/edit/delete)
  useFocusEffect(
    useCallback(() => {
      if (masterPassword && userEmail) {
        loadPasswords();
      }
    }, [masterPassword, userEmail])
  );

  useEffect(() => {
    filterPasswords();
  }, [passwords, searchQuery, selectedCategory]);

  const loadPasswords = async () => {
    if (!masterPassword || !userEmail) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await api.getAllPasswords(userEmail, masterPassword);
      setPasswords(data);
    } catch (error) {
      if (masterPassword) {
        showAlert('Errore', 'Impossibile caricare le password');
      }
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
    showAlert('Copiato', `Password di ${accountName} copiata negli appunti`);
  };

  const handleDeletePassword = (id: string, accountName: string) => {
    if (!userEmail || !masterPassword) {
      showAlert('Errore', 'Sessione scaduta. Accedi di nuovo.');
      router.replace('/login');
      return;
    }

    showConfirm(
      'Conferma',
      `Vuoi eliminare la password per ${accountName}?`,
      async () => {
        try {
          await api.deletePassword(id, userEmail, masterPassword);
          await loadPasswords();
          showAlert('Successo', 'Password eliminata');
        } catch (error: any) {
          showAlert('Errore', error.message || 'Impossibile eliminare la password');
        }
      },
      'Elimina',
    );
  };

  const handleEnableBiometric = async () => {
    try {
      await enableBiometric();
      showAlert('Successo', 'Autenticazione biometrica abilitata');
    } catch (error: any) {
      showAlert('Errore', error.message);
    }
  };

  const handleDisableBiometric = () => {
    showConfirm(
      'Disabilita Biometrica',
      'Vuoi disabilitare l\'accesso biometrico? Potrai riabilitarlo dopo il prossimo login.',
      async () => {
        try {
          await disableBiometric();
          showAlert('Successo', 'Autenticazione biometrica disabilitata');
        } catch (error: any) {
          showAlert('Errore', error.message);
        }
      },
      'Disabilita',
    );
  };

  const handleToggleBiometric = () => {
    if (isBiometricEnabled) {
      handleDisableBiometric();
    } else {
      handleEnableBiometric();
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      'Social Media': 'share-social',
      'Email': 'mail',
      'Banca': 'cash',
      'Acquisti': 'cart',
      'Lavoro': 'briefcase',
      'Intrattenimento': 'film',
      'Videogiochi': 'game-controller',
      'Viaggi': 'airplane',
      'Istruzione': 'school',
      'Salute': 'fitness',
      'Altro': 'ellipsis-horizontal',
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
          <TouchableOpacity
            testID="toggle-biometric-button"
            style={styles.headerButton}
            onPress={handleToggleBiometric}
          >
            <Ionicons
              name={isBiometricEnabled ? 'finger-print' : 'finger-print-outline'}
              size={24}
              color={isBiometricEnabled ? '#4ecdc4' : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="logout-button"
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

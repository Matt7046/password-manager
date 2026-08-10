import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity as RNTouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { showAlert, showConfirm } from '@/src/utils/alert';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import WebSortableList, { WebDragHandleProps } from './WebSortableList';
import { styles } from './Home.styles';

const PERSONALITY_URL = 'https://colorsdev.tech/personality';

export default function Home() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [filteredPasswords, setFilteredPasswords] = useState<PasswordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { masterPassword, userEmail, logout, isBiometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const router = useRouter();

  const categories = ['Tutti', 'Social Media', 'Email', 'Banca', 'Acquisti', 'Lavoro', 'Intrattenimento', 'Videogiochi', 'Viaggi', 'Istruzione', 'Salute', 'Altro'];
  const listClean = selectedCategory === 'Tutti' && !searchQuery.trim();
  const canReorder = listClean && reorderMode && !reordering;
  const isWeb = Platform.OS === 'web';

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

  useEffect(() => {
    if (!listClean && reorderMode) {
      setReorderMode(false);
    }
  }, [listClean, reorderMode]);

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

  const persistOrder = async (ordered: PasswordEntry[]) => {
    if (!userEmail || !masterPassword) return;
    setReordering(true);
    setPasswords(ordered);
    setFilteredPasswords(ordered);
    try {
      await api.reorderPasswords(
        userEmail,
        masterPassword,
        ordered.map((p) => p.id),
      );
    } catch (error: any) {
      showAlert('Errore', error.message || 'Impossibile salvare l\'ordine');
      await loadPasswords();
    } finally {
      setReordering(false);
    }
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    if (!canReorder) return;
    const idx = filteredPasswords.findIndex((p) => p.id === id);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= filteredPasswords.length) return;
    const next = [...filteredPasswords];
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    void persistOrder(next);
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

  const renderCardBody = (
    item: PasswordEntry,
    index: number,
    isActive: boolean,
    drag?: () => void,
    DragHandle?: React.ComponentType<WebDragHandleProps>,
  ) => {
    const HandleWrap = DragHandle;
    const handleIcon = <Ionicons name="menu" size={26} color="#4ecdc4" />;
    const cardMainContent = (
      <>
        <View style={styles.iconCircle}>
          <Ionicons name={getCategoryIcon(item.category)} size={24} color="#4ecdc4" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.accountName}>{item.account_name}</Text>
          <Text style={styles.username}>{item.username}</Text>
          <View style={styles.tagContainer}>
            <Text style={styles.categoryBadge}>{item.category}</Text>
            {item.tags.map((tag, tagIndex) => (
              <Text key={tagIndex} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        </View>
      </>
    );

    return (
      <View
        style={[
          styles.passwordCard,
          isActive && styles.passwordCardActive,
          canReorder && styles.passwordCardReorder,
        ]}
      >
        <View style={styles.cardHeader}>
          {canReorder ? (
            HandleWrap ? (
              <HandleWrap style={styles.dragHandle}>{handleIcon}</HandleWrap>
            ) : (
              <TouchableOpacity
                style={styles.dragHandle}
                onLongPress={drag}
                delayLongPress={250}
                disabled={isActive}
                accessibilityLabel="Tieni premuto e trascina per riordinare"
              >
                {handleIcon}
              </TouchableOpacity>
            )
          ) : null}

          {canReorder && HandleWrap ? (
            <HandleWrap style={styles.cardMain} captureTouch={false}>
              {cardMainContent}
            </HandleWrap>
          ) : (
            <RNTouchableOpacity
              style={styles.cardMain}
              onPress={() => {
                if (canReorder) return;
                router.push(`/password-detail?id=${item.id}`);
              }}
              onLongPress={canReorder ? drag : undefined}
              delayLongPress={250}
              activeOpacity={0.85}
              disabled={isActive}
            >
              {cardMainContent}
            </RNTouchableOpacity>
          )}
        </View>

        {canReorder ? (
          <View style={styles.reorderActions}>
            <RNTouchableOpacity
              style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
              disabled={index === 0 || reordering}
              onPress={() => moveItem(item.id, -1)}
              accessibilityLabel="Sposta su"
            >
              <Ionicons name="chevron-up" size={22} color={index === 0 ? '#444' : '#4ecdc4'} />
            </RNTouchableOpacity>
            <RNTouchableOpacity
              style={[
                styles.reorderBtn,
                index >= filteredPasswords.length - 1 && styles.reorderBtnDisabled,
              ]}
              disabled={index >= filteredPasswords.length - 1 || reordering}
              onPress={() => moveItem(item.id, 1)}
              accessibilityLabel="Sposta giu"
            >
              <Ionicons
                name="chevron-down"
                size={22}
                color={index >= filteredPasswords.length - 1 ? '#444' : '#4ecdc4'}
              />
            </RNTouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardActions}>
            <RNTouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCopyPassword(item.password, item.account_name)}
            >
              <Ionicons name="copy" size={20} color="#4ecdc4" />
            </RNTouchableOpacity>
            <RNTouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/edit-password?id=${item.id}`)}
            >
              <Ionicons name="create" size={20} color="#ffa500" />
            </RNTouchableOpacity>
            <RNTouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeletePassword(item.id, item.account_name)}
            >
              <Ionicons name="trash" size={20} color="#ff6b6b" />
            </RNTouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderNativeItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PasswordEntry>) => {
    const index = getIndex?.() ?? 0;
    return (
      <ScaleDecorator activeScale={1.03}>
        {renderCardBody(item, index, isActive, drag)}
      </ScaleDecorator>
    );
  };

  const listRefreshControl = reorderMode ? undefined : (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadPasswords();
      }}
      tintColor="#4ecdc4"
    />
  );

  const listEmpty = (
    <View style={styles.emptyContainer}>
      <Ionicons name="lock-open" size={64} color="#666" />
      <Text style={styles.emptyText}>Nessuna password trovata</Text>
      <Text style={styles.emptySubtext}>Aggiungi la tua prima password</Text>
    </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Password Manager</Text>
        <View style={styles.headerActions}>
          <RNTouchableOpacity
            style={styles.headerButton}
            onPress={() => Linking.openURL(PERSONALITY_URL)}
            accessibilityLabel="Analisi personalita"
          >
            <Ionicons name="color-wand-outline" size={22} color="#60a5fa" />
          </RNTouchableOpacity>
          {listClean ? (
            <RNTouchableOpacity
              style={styles.headerButton}
              onPress={() => setReorderMode((v) => !v)}
              accessibilityLabel="Modalita riordino"
            >
              <Ionicons
                name={reorderMode ? 'checkmark-circle' : 'swap-vertical'}
                size={24}
                color={reorderMode ? '#4ecdc4' : '#666'}
              />
            </RNTouchableOpacity>
          ) : null}
          <RNTouchableOpacity
            testID="toggle-biometric-button"
            style={styles.headerButton}
            onPress={handleToggleBiometric}
          >
            <Ionicons
              name={isBiometricEnabled ? 'finger-print' : 'finger-print-outline'}
              size={24}
              color={isBiometricEnabled ? '#4ecdc4' : '#666'}
            />
          </RNTouchableOpacity>
          <RNTouchableOpacity
            testID="logout-button"
            style={styles.headerButton}
            onPress={() => {
              logout();
              router.replace('/login');
            }}
          >
            <Ionicons name="log-out" size={24} color="#ff6b6b" />
          </RNTouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca per nome account..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!reorderMode}
        />
        {searchQuery ? (
          <RNTouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </RNTouchableOpacity>
        ) : null}
      </View>

      <RNTouchableOpacity
        style={[styles.categorySelector, reorderMode && styles.categorySelectorDisabled]}
        onPress={() => {
          if (reorderMode) return;
          setShowCategoryModal(true);
        }}
        disabled={reorderMode}
      >
        <Ionicons name="filter" size={20} color="#4ecdc4" />
        <Text style={styles.categoryText}>{selectedCategory}</Text>
        <Ionicons name="chevron-down" size={20} color="#4ecdc4" />
      </RNTouchableOpacity>

      {reorderMode ? (
        <Text style={styles.reorderHint}>
          Scorri la lista liberamente. Per spostare: tieni premuto ≡ (o la card), oppure usa ↑↓
        </Text>
      ) : null}

      {isWeb ? (
        <WebSortableList
          data={filteredPasswords}
          enabled={canReorder}
          onDraggingChange={setDragging}
          onDragEnd={(data) => {
            if (!canReorder) return;
            void persistOrder(data);
          }}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, isActive, DragHandle }) =>
            renderCardBody(item, index, isActive, undefined, DragHandle)
          }
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContainer}
          scrollEnabled
          refreshControl={listRefreshControl}
          ListEmptyComponent={listEmpty}
        />
      ) : (
        <DraggableFlatList
          data={filteredPasswords}
          onDragBegin={() => setDragging(true)}
          onDragEnd={({ data }) => {
            setDragging(false);
            if (!canReorder) return;
            void persistOrder(data);
          }}
          keyExtractor={(item) => item.id}
          renderItem={renderNativeItem}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={styles.listContainer}
          activationDistance={canReorder ? 8 : 9999}
          autoscrollSpeed={80}
          autoscrollThreshold={60}
          scrollEnabled={!dragging}
          refreshControl={listRefreshControl}
          ListEmptyComponent={listEmpty}
        />
      )}

      {!reorderMode ? (
        <RNTouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-password')}
        >
          <Ionicons name="add" size={32} color="#1a1a2e" />
        </RNTouchableOpacity>
      ) : null}

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <RNTouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleziona Categoria</Text>
            {categories.map((cat) => (
              <RNTouchableOpacity
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
              </RNTouchableOpacity>
            ))}
          </View>
        </RNTouchableOpacity>
      </Modal>
    </View>
  );
}

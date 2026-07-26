import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { showAlert } from '@/src/utils/alert';
import { styles } from './PasswordDetail.styles';

export default function PasswordDetail() {
  const [entry, setEntry] = useState<PasswordEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { id } = useLocalSearchParams();
  const { masterPassword, userEmail } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    loadPassword();
  }, []);

  const loadPassword = async () => {
    try {
      const passwords = await api.getAllPasswords(userEmail, masterPassword!);
      const found = passwords.find(p => p.id === id);
      if (found) {
        setEntry(found);
      } else {
        showAlert('Errore', 'Password non trovata');
        router.back();
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile caricare la password');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showAlert('Copiato', `${label} copiato negli appunti`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ecdc4" />
      </View>
    );
  }

  if (!entry) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dettagli</Text>
        <TouchableOpacity
          onPress={() => router.push(`/edit-password?id=${entry.id}`)}
          style={styles.editButton}
        >
          <Ionicons name="create" size={24} color="#4ecdc4" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={64} color="#4ecdc4" />
        </View>

        <Text style={styles.accountName}>{entry.account_name}</Text>

        <View style={[styles.detailCard, isWide && styles.detailCardWide]}>
          <View style={styles.credentialBlock}>
            <View style={styles.detailLabel}>
              <Ionicons name="mail" size={20} color="#999" />
              <Text style={styles.labelText}>Username / Email</Text>
            </View>
            <View style={styles.credentialValueRow}>
              <Text style={styles.valueText} selectable>
                {entry.username}
              </Text>
              <TouchableOpacity
                onPress={() => handleCopy(entry.username, 'Username')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="copy" size={20} color="#4ecdc4" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.credentialBlock}>
            <View style={styles.detailLabel}>
              <Ionicons name="lock-closed" size={20} color="#999" />
              <Text style={styles.labelText}>Password</Text>
            </View>
            <View style={styles.credentialValueRow}>
              <Text style={styles.valueText} selectable>
                {showPassword ? entry.password : '••••••••'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#4ecdc4"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleCopy(entry.password, 'Password')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="copy" size={20} color="#4ecdc4" />
              </TouchableOpacity>
            </View>
          </View>

          {entry.url ? (
            <>
              <View style={styles.separator} />
              <View style={styles.credentialBlock}>
                <View style={styles.detailLabel}>
                  <Ionicons name="globe" size={20} color="#999" />
                  <Text style={styles.labelText}>URL</Text>
                </View>
                <View style={styles.credentialValueRow}>
                  <Text style={styles.valueText} selectable numberOfLines={2}>
                    {entry.url}
                  </Text>
                  <TouchableOpacity onPress={() => handleCopy(entry.url, 'URL')}>
                    <Ionicons name="copy" size={20} color="#4ecdc4" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="folder" size={20} color="#999" />
              <Text style={styles.labelText}>Categoria</Text>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{entry.category}</Text>
            </View>
          </View>

          {entry.tags.length > 0 && (
            <>
              <View style={styles.separator} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="pricetag" size={20} color="#999" />
                  <Text style={styles.labelText}>Tag</Text>
                </View>
                <View style={styles.tagsContainer}>
                  {entry.tags.map((tag, index) => (
                    <Text key={index} style={styles.tag}>
                      #{tag}
                    </Text>
                  ))}
                </View>
              </View>
            </>
          )}

          {entry.notes ? (
            <>
              <View style={styles.separator} />
              <View style={styles.detailColumn}>
                <View style={styles.detailLabel}>
                  <Ionicons name="document-text" size={20} color="#999" />
                  <Text style={styles.labelText}>Note</Text>
                </View>
                <Text style={styles.notesText}>{entry.notes}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.metadata}>
          <Text style={styles.metadataText}>
            Creato: {new Date(entry.created_at).toLocaleDateString('it-IT')}
          </Text>
          <Text style={styles.metadataText}>
            Modificato: {new Date(entry.updated_at).toLocaleDateString('it-IT')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

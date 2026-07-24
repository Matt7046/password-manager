import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { api, PasswordEntry } from '@/src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function PasswordDetailScreen() {
  const [entry, setEntry] = useState<PasswordEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { id } = useLocalSearchParams();
  const { masterPassword } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadPassword();
  }, []);

  const loadPassword = async () => {
    try {
      const passwords = await api.getAllPasswords(masterPassword!);
      const found = passwords.find(p => p.id === id);
      if (found) {
        setEntry(found);
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

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiato', `${label} copiato negli appunti`);
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={64} color="#4ecdc4" />
        </View>

        <Text style={styles.accountName}>{entry.account_name}</Text>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="mail" size={20} color="#999" />
              <Text style={styles.labelText}>Username / Email</Text>
            </View>
            <View style={styles.detailValue}>
              <Text style={styles.valueText}>{entry.username}</Text>
              <TouchableOpacity onPress={() => handleCopy(entry.username, 'Username')}>
                <Ionicons name="copy" size={20} color="#4ecdc4" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="lock-closed" size={20} color="#999" />
              <Text style={styles.labelText}>Password</Text>
            </View>
            <View style={styles.detailValue}>
              <Text style={styles.valueText}>
                {showPassword ? entry.password : '••••••••'}
              </Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#4ecdc4"
                  style={{ marginHorizontal: 8 }}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleCopy(entry.password, 'Password')}>
                <Ionicons name="copy" size={20} color="#4ecdc4" />
              </TouchableOpacity>
            </View>
          </View>

          {entry.url && (
            <>
              <View style={styles.separator} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="globe" size={20} color="#999" />
                  <Text style={styles.labelText}>URL</Text>
                </View>
                <View style={styles.detailValue}>
                  <Text style={styles.valueText} numberOfLines={1}>
                    {entry.url}
                  </Text>
                  <TouchableOpacity onPress={() => handleCopy(entry.url, 'URL')}>
                    <Ionicons name="copy" size={20} color="#4ecdc4" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

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

          {entry.notes && (
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
          )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  editButton: {
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
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  accountName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailColumn: {
    paddingVertical: 12,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelText: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  valueText: {
    color: '#fff',
    fontSize: 16,
    maxWidth: 150,
  },
  separator: {
    height: 1,
    backgroundColor: '#0f3460',
  },
  categoryBadge: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  tag: {
    color: '#4ecdc4',
    fontSize: 14,
  },
  notesText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    lineHeight: 24,
  },
  metadata: {
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    color: '#666',
    fontSize: 12,
  },
});

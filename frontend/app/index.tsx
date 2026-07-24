import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isSetup } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/home');
    } else if (isSetup) {
      router.replace('/login');
    } else {
      router.replace('/setup');
    }
  }, [isAuthenticated, isSetup]);

  return (
    <View style={styles.container} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

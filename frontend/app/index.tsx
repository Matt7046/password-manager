import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Index() {
  const { isAuthenticated, isSetup, isCheckingSetup } = useAuth();

  // Show loading while checking initial setup status
  if (isCheckingSetup) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4ecdc4" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }
  
  if (isSetup) {
    return <Redirect href="/login" />;
  }
  
  return <Redirect href="/setup" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

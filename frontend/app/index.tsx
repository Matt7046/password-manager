import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Index() {
  const { isAuthenticated, isSetup } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }
  
  if (isSetup) {
    return <Redirect href="/login" />;
  }
  
  return <Redirect href="/setup" />;
}

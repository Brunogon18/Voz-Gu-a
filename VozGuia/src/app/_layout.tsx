import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../services/database';
import { meshService } from '../services/meshService';

export default function RootLayout() {
  useEffect(() => {
    void initDatabase();
    void meshService.start();

    const subscription = AppState.addEventListener('change', (nextState) => {
      // OS power policies suspend background BLE scanning; track foreground state explicitly
      meshService.setForegroundActive(nextState === 'active');
    });

    return () => {
      subscription.remove();
      void meshService.stop();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}

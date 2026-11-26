import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpeechControlBar } from '../components/SpeechControlBar';
import { initDatabase } from '../services/database';
import { meshService } from '../services/meshService';

export default function RootLayout() {
  useEffect(() => {
    try {
      void initDatabase().catch((e) => console.warn('initDatabase error:', e));
    } catch (e) {
      console.warn('initDatabase sync error:', e);
    }

    try {
      void meshService.start().catch((e) => console.warn('meshService start error:', e));
    } catch (e) {
      console.warn('meshService sync error:', e);
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      // OS power policies suspend background BLE scanning; track foreground state explicitly
      try {
        meshService.setForegroundActive(nextState === 'active');
      } catch (e) {
        console.warn('meshService setForegroundActive error:', e);
      }
    });

    return () => {
      subscription.remove();
      try {
        void meshService.stop().catch((e) => console.warn('meshService stop error:', e));
      } catch (e) {
        console.warn('meshService stop sync error:', e);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mesh" />
          <Stack.Screen name="tramites" />
        </Stack>
        <SpeechControlBar variant="floating" />
      </View>
    </SafeAreaProvider>
  );
}

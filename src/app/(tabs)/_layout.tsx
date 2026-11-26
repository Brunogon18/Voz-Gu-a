import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.outlineVariant,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={typeof color === 'string' ? color : Colors.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="conversacion"
        options={{
          title: 'Conversación',
          tabBarLabel: 'Conversación',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={size}
              color={typeof color === 'string' ? color : Colors.primary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarLabel: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="time-outline"
              size={size}
              color={typeof color === 'string' ? color : Colors.primary}
            />
          ),
        }}
      />
      {/* Pestaña oculta para Ajustes de red mesh si se requiere acceder */}
      <Tabs.Screen
        name="mesh"
        options={{
          href: null,
          title: 'Ajustes',
        }}
      />
      {/* Pestaña anterior redirigida o mantenida sin visualización directa */}
      <Tabs.Screen
        name="tramites"
        options={{
          href: null,
          title: 'Trámites',
        }}
      />
    </Tabs>
  );
}

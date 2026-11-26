import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0B5D4B',
        tabBarInactiveTintColor: '#5B6F69',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        tabBarStyle: { height: 66, paddingBottom: 8, paddingTop: 6 },
        headerStyle: { backgroundColor: '#0B5D4B' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Voz Guía',
          tabBarLabel: 'Asistente',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="mic"
              size={size}
              color={typeof color === 'string' ? color : '#0B5D4B'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tramites"
        options={{
          title: 'Catálogo de Trámites',
          tabBarLabel: 'Trámites',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="document-text"
              size={size}
              color={typeof color === 'string' ? color : '#0B5D4B'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mesh"
        options={{
          title: 'Red Mesh y Ajustes',
          tabBarLabel: 'Red Mesh',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="bluetooth"
              size={size}
              color={typeof color === 'string' ? color : '#0B5D4B'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

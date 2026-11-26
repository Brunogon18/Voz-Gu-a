import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../theme/tokens';

interface AppHeaderProps {
  title: string;
  onOpenNotices?: () => void;
  meshActive?: boolean;
  showBackButton?: boolean;
}

export function AppHeader({
  title,
  onOpenNotices,
  meshActive = true,
  showBackButton = false,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 0 : insets.top;

  const handleOpenSettings = () => {
    router.push('/(tabs)/mesh');
  };

  return (
    <View style={[styles.wrapper, { paddingTop: topInset }]}>
      <View style={styles.container}>
        {showBackButton ? (
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.notifBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver a Inicio"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onOpenNotices}
            style={styles.notifBtn}
            accessibilityRole="button"
            accessibilityLabel="Abrir tablón de avisos"
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.onSurface} />
            <View style={styles.redDot} />
          </Pressable>
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.rightCluster}>
          <Pressable
            onPress={handleOpenSettings}
            style={styles.meshPill}
            accessibilityRole="button"
            accessibilityLabel="Abrir ajustes de Red Mesh y Gemini AI"
          >
            <Ionicons name="bluetooth" size={15} color={Colors.onSecondaryContainer} />
            <Text style={styles.meshPillText}>{meshActive ? 'Mesh activo' : 'Mesh pausado'}</Text>
          </Pressable>

          <Pressable
            onPress={handleOpenSettings}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Ajustes y clave de Gemini"
          >
            <Ionicons name="settings-outline" size={18} color={Colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  container: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    gap: 8,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.error,
  },
  title: {
    ...Typography.headlineSm,
    fontSize: 20,
    color: Colors.primary,
    fontWeight: '800',
    flexShrink: 1,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  meshPillText: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.onSecondaryContainer,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

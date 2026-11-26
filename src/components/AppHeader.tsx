import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme/tokens';

interface AppHeaderProps {
  title: string;
  onOpenNotices?: () => void;
  meshActive?: boolean;
}

export function AppHeader({ title, onOpenNotices, meshActive = true }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onOpenNotices}
        style={styles.notifBtn}
        accessibilityLabel="Abrir tablón de avisos"
      >
        <Ionicons name="notifications-outline" size={24} color={Colors.onSurface} />
        <View style={styles.redDot} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.rightCluster}>
        <View style={styles.meshPill}>
          <Ionicons name="bluetooth" size={15} color={Colors.onSecondaryContainer} />
          <Text style={styles.meshPillText}>{meshActive ? 'Mesh activo' : 'Mesh pausado'}</Text>
        </View>

        <View style={styles.avatar}>
          <Ionicons name="person" size={16} color={Colors.onPrimary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
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
    paddingVertical: 5,
    borderRadius: 99,
  },
  meshPillText: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.onSecondaryContainer,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

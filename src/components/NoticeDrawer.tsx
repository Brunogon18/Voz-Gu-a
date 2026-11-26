import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme/tokens';
import { speakSpanish } from '../services/voiceService';

interface NoticeDrawerProps {
  visible: boolean;
  onClose: () => void;
  meshNodesCount?: number;
}

export function NoticeDrawer({ visible, onClose, meshNodesCount = 3 }: NoticeDrawerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.campaignIcon}>
                <Ionicons name="megaphone" size={20} color={Colors.onPrimary} />
              </View>
              <Text style={styles.title}>Tablón de Avisos</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Cerrar avisos">
              <Ionicons name="close" size={24} color={Colors.onSurface} />
            </Pressable>
          </View>

          {/* Mesh status */}
          <View style={styles.meshBanner}>
            <View style={styles.meshLeft}>
              <View style={styles.pulseDot} />
              <Text style={styles.meshText}>Red Mesh BLE activa</Text>
            </View>
            <View style={styles.nodesBadge}>
              <Text style={styles.nodesText}>{meshNodesCount} nodos</Text>
            </View>
          </View>

          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {/* Aviso 1: Becas */}
            <View style={styles.noticeCard}>
              <View style={styles.cardTop}>
                <View style={[styles.categoryBadge, { backgroundColor: Colors.primaryFixed }]}>
                  <Ionicons name="school" size={14} color={Colors.onPrimaryFixed} />
                  <Text style={[styles.badgeText, { color: Colors.onPrimaryFixed }]}>Becas</Text>
                </View>
                <Text style={styles.timeText}>Hoy, 09:40</Text>
              </View>
              <Text style={styles.noticeHeading}>Convocatoria de Becas 2025 abierta</Text>
              <Text style={styles.noticeBody}>
                Ya puedes consultar los requisitos y fechas de registro para apoyo educativo.
              </Text>
              <View style={styles.meshOrigin}>
                <Ionicons name="git-network-outline" size={16} color={Colors.secondary} />
                <Text style={styles.meshOriginText}>Recibido vía Red Mesh</Text>
              </View>
              <Pressable
                style={styles.listenNoticeBtn}
                onPress={() => {
                  void speakSpanish(
                    'Aviso de becas: Convocatoria de Becas 2025 abierta. Ya puedes consultar los requisitos y fechas de registro para apoyo educativo.'
                  );
                }}
              >
                <Ionicons name="volume-high" size={20} color={Colors.onPrimary} />
                <Text style={styles.listenNoticeText}>Escuchar aviso</Text>
              </Pressable>
            </View>

            {/* Aviso 2: Salud */}
            <View style={styles.noticeCard}>
              <View style={styles.cardTop}>
                <View style={[styles.categoryBadge, { backgroundColor: Colors.tertiaryFixed }]}>
                  <Ionicons name="medkit" size={14} color={Colors.onTertiaryFixedVariant} />
                  <Text style={[styles.badgeText, { color: Colors.onTertiaryFixedVariant }]}>Salud</Text>
                </View>
                <Text style={styles.timeText}>Ayer, 16:15</Text>
              </View>
              <Text style={styles.noticeHeading}>
                Jornada de vacunación y citas médicas en Centro de Salud
              </Text>
              <Text style={styles.noticeBody}>
                Atención prioritaria para adultos mayores de 8:00 a 14:00 horas. Lleva tu cartilla.
              </Text>
              <View style={styles.meshOrigin}>
                <Ionicons name="git-network-outline" size={16} color={Colors.secondary} />
                <Text style={styles.meshOriginText}>Recibido vía Red Mesh</Text>
              </View>
              <Pressable
                style={styles.listenNoticeBtn}
                onPress={() => {
                  void speakSpanish(
                    'Aviso de salud: Jornada de vacunación y citas médicas en Centro de Salud. Atención prioritaria para adultos mayores de 8 a 14 horas.'
                  );
                }}
              >
                <Ionicons name="volume-high" size={20} color={Colors.onPrimary} />
                <Text style={styles.listenNoticeText}>Escuchar aviso</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawer: {
    width: '88%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    height: '100%',
    paddingTop: 44,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  campaignIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineMd,
    fontSize: 20,
    color: Colors.primary,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondaryContainer,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  meshLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.secondary,
  },
  meshText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  nodesBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  nodesText: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.secondary,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.margin,
    gap: Spacing.md,
  },
  noticeCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    ...Typography.labelSm,
    fontSize: 12,
  },
  timeText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  noticeHeading: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.primary,
  },
  noticeBody: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  meshOrigin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  meshOriginText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  listenNoticeBtn: {
    minHeight: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  listenNoticeText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
});

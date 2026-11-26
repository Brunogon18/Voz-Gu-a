import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppHeader } from '../../components/AppHeader';
import { NoticeDrawer } from '../../components/NoticeDrawer';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { speakSpanish } from '../../services/voiceService';

interface HistoryItem {
  id: string;
  category: 'becas' | 'salud' | 'educacion';
  categoryLabel: string;
  status: 'Completado' | 'En progreso';
  title: string;
  dateText: string;
  summary: string;
}

const HISTORY_DATA: HistoryItem[] = [
  {
    id: '1',
    category: 'becas',
    categoryLabel: 'Becas',
    status: 'Completado',
    title: 'Solicitud de Beca de Manutención',
    dateText: 'Hace 2 días',
    summary:
      'Folio #BM-4092 guardado localmente. Todos los documentos fueron enviados correctamente.',
  },
  {
    id: '2',
    category: 'salud',
    categoryLabel: 'Salud',
    status: 'En progreso',
    title: 'Cita médica en Centro de Salud',
    dateText: 'Hoy',
    summary:
      'Paso 2 de 3: Falta confirmar el horario disponible con tu voz o tocando la opción en pantalla.',
  },
  {
    id: '3',
    category: 'educacion',
    categoryLabel: 'Educación',
    status: 'Completado',
    title: 'Constancia de estudios SEP',
    dateText: 'Hace 1 semana',
    summary:
      'Documento validado y listo para descarga o consulta de vigencia sin conexión a internet.',
  },
];

export default function HistorialScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'todos' | 'becas' | 'salud' | 'educacion'>('todos');
  const [modalItem, setModalItem] = useState<HistoryItem | null>(null);

  const filteredItems = HISTORY_DATA.filter((item) => {
    if (selectedFilter === 'todos') return true;
    return item.category === selectedFilter;
  });

  return (
    <View style={styles.screen}>
      <AppHeader title="Historial" onOpenNotices={() => setDrawerOpen(true)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Historial de Trámites</Text>
          <View style={styles.offlinePill}>
            <Ionicons name="checkmark-done-circle" size={18} color={Colors.secondary} />
            <Text style={styles.offlineText}>
              Guardado en tu teléfono para consulta sin internet
            </Text>
          </View>
        </View>

        {/* Chips de filtro */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Pressable
            style={[styles.filterChip, selectedFilter === 'todos' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('todos')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'todos' && styles.filterChipTextActive]}>
              Todos ({HISTORY_DATA.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, selectedFilter === 'becas' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('becas')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'becas' && styles.filterChipTextActive]}>
              Becas
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, selectedFilter === 'salud' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('salud')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'salud' && styles.filterChipTextActive]}>
              Salud
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, selectedFilter === 'educacion' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('educacion')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'educacion' && styles.filterChipTextActive]}>
              Educación
            </Text>
          </Pressable>
        </ScrollView>

        {/* Lista de tarjetas */}
        <View style={styles.cardsList}>
          {filteredItems.map((item) => {
            const isCompleted = item.status === 'Completado';
            const iconName =
              item.category === 'becas'
                ? 'school'
                : item.category === 'salud'
                ? 'medical'
                : 'document-text';

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.catLeft}>
                    <View
                      style={[
                        styles.catIconCircle,
                        item.category === 'becas' && { backgroundColor: Colors.primaryFixed },
                        item.category === 'salud' && { backgroundColor: Colors.tertiaryFixed },
                        item.category === 'educacion' && { backgroundColor: Colors.primaryFixed },
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={18}
                        color={
                          item.category === 'salud'
                            ? Colors.onTertiaryFixedVariant
                            : Colors.onPrimaryFixed
                        }
                      />
                    </View>
                    <Text style={styles.catName}>{item.categoryLabel}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isCompleted ? styles.statusCompleted : styles.statusInProgress,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isCompleted
                            ? Colors.secondary
                            : Colors.onTertiaryFixedVariant,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isCompleted
                            ? Colors.onSecondaryContainer
                            : Colors.onTertiaryFixedVariant,
                        },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>

                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.onSurfaceVariant} />
                  <Text style={styles.dateText}>{item.dateText}</Text>
                </View>

                <Pressable
                  style={[
                    styles.actionBtn,
                    isCompleted ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.secondary },
                  ]}
                  onPress={() => setModalItem(item)}
                >
                  <Text style={styles.actionBtnText}>
                    {isCompleted ? 'Ver resumen' : 'Continuar'}
                  </Text>
                  <Ionicons
                    name={isCompleted ? 'arrow-forward' : 'play'}
                    size={18}
                    color={Colors.onPrimary}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal con detalle del trámite */}
      <Modal visible={Boolean(modalItem)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalItem?.title}</Text>
            <Text style={styles.modalBody}>{modalItem?.summary}</Text>

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalVoiceBtn}
                onPress={() => {
                  if (modalItem) {
                    void speakSpanish(`${modalItem.title}. ${modalItem.summary}`);
                  }
                }}
              >
                <Ionicons name="volume-high" size={20} color={Colors.primary} />
                <Text style={styles.modalVoiceText}>Escuchar</Text>
              </Pressable>

              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  const query = modalItem?.title;
                  setModalItem(null);
                  if (query) {
                    router.push({
                      pathname: '/(tabs)/conversacion',
                      params: { prompt: query },
                    });
                  }
                }}
              >
                <Text style={styles.modalCloseText}>Abrir en Asistente</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.modalDismissBtn}
              onPress={() => setModalItem(null)}
            >
              <Text style={styles.modalDismissText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <NoticeDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.margin,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  titleSection: {
    gap: 8,
  },
  mainTitle: {
    ...Typography.headlineLg,
    color: Colors.primary,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  offlineText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: Colors.onPrimary,
  },
  cardsList: {
    gap: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusCompleted: {
    backgroundColor: Colors.secondaryContainer,
  },
  statusInProgress: {
    backgroundColor: Colors.tertiaryFixed,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    ...Typography.labelSm,
    fontSize: 12,
  },
  cardTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  actionBtn: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
  },
  modalBody: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 22,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalVoiceBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalVoiceText: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  modalCloseBtn: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
  modalDismissBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalDismissText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
});

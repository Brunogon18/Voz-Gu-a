import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { NoticeDrawer } from '../../components/NoticeDrawer';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { pickDocumentImage, DocumentPickMode } from '../../services/documentPicker';
import { meshService } from '../../services/meshService';
import { setPendingDocument } from '../../services/pendingDocument';
import {
  detectSpeechControlCommand,
  executeSpeechCommand,
} from '../../services/voiceService';
import { OFFICIAL_TRAMITE_SOURCES } from '../../services/webTramiteService';
import { MeshStats } from '../../types/vozGuia';

export default function HomeScreen() {
  const router = useRouter();
  const reqSeqRef = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [feedback, setFeedback] = useState('');
  const [meshStats, setMeshStats] = useState<MeshStats>(() => meshService.getStats());

  const nextReqId = useCallback(() => {
    reqSeqRef.current += 1;
    return String(reqSeqRef.current);
  }, []);

  useEffect(() => {
    return meshService.subscribe(() => {
      setMeshStats(meshService.getStats());
    });
  }, []);

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      const cmd = detectSpeechControlCommand(transcript);
      if (cmd) {
        void executeSpeechCommand(cmd).then((msg) => setFeedback(msg));
        return;
      }
      router.push({
        pathname: '/(tabs)/conversacion',
        params: {
          prompt: transcript,
          autoSpeak: '1',
          reqId: nextReqId(),
        },
      });
    },
    [nextReqId, router]
  );

  const { isListening, isTranscribing, toggleVoice, usesTapToStopRecording } = useVoiceCapture({
    onTranscript: handleVoiceTranscript,
    onFeedback: setFeedback,
  });

  const handleScanDocument = async (mode: DocumentPickMode) => {
    setFeedback(
      mode === 'camera'
        ? 'Abriendo cámara para leer tu documento con Gemini...'
        : 'Abriendo galería para elegir una imagen...'
    );
    const picked = await pickDocumentImage(mode);
    if (picked.status === 'cancelled') {
      setFeedback('');
      return;
    }
    if (picked.status !== 'picked' || !picked.image) {
      setFeedback(picked.message ?? 'No se pudo cargar la imagen.');
      return;
    }

    const scanId = setPendingDocument(picked.image);
    setFeedback('Documento listo. Analizando con Gemini AI...');
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { scanId },
    });
  };

  const handleOpenWebSource = useCallback(
    (url: string, label?: string) => {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;
      setCustomUrl('');
      router.push({
        pathname: '/(tabs)/conversacion',
        params: {
          sourceUrl: cleanUrl,
          prompt: label || cleanUrl,
          autoSpeak: '1',
          reqId: nextReqId(),
        },
      });
    },
    [nextReqId, router]
  );

  const handleSendText = () => {
    const clean = query.trim();
    if (!clean) return;
    setQuery('');
    const cmd = detectSpeechControlCommand(clean);
    if (cmd) {
      void executeSpeechCommand(cmd).then((msg) => setFeedback(msg));
      return;
    }
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { prompt: clean, reqId: nextReqId() },
    });
  };

  const handleCategoryPress = (category: string, example: string) => {
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { category, prompt: example, reqId: nextReqId() },
    });
  };

  const meshStatusLabel =
    meshStats.transportMode === 'ble-gatt'
      ? `Red BLE GATT activa • ${meshStats.connectedPeers} vecino(s)`
      : meshStats.transportMode === 'lan-relay'
      ? `Red Mesh LAN activa • ${meshStats.connectedPeers} vecino(s)`
      : meshStats.transportMode === 'web-broadcast'
      ? `Red Mesh Web activa • ${meshStats.connectedPeers} nodo(s)`
      : 'Catálogo offline listo • Toca Ajustes para Red Mesh';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader
        title="Inicio"
        onOpenNotices={() => setDrawerOpen(true)}
        meshActive={meshStats.isRunning}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Etiqueta informativa Red Mesh */}
        <Pressable
          style={styles.meshPill}
          onPress={() => router.push('/(tabs)/mesh')}
          accessibilityRole="button"
        >
          <View style={styles.pulseDot} />
          <Text style={styles.meshPillText}>{meshStatusLabel}</Text>
        </Pressable>

        {/* Título de bienvenida */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>¿En qué trámite te ayudo hoy?</Text>
          <Text style={styles.subTitle}>
            Toca el micrófono para hablar, extrae una guía de una página oficial o toma foto a un
            papel.
          </Text>
        </View>

        {/* Micrófono grande central con ondas */}
        <View style={styles.micSection}>
          <View style={styles.waveOuter} />
          <View style={styles.waveInner} />
          <Pressable
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
              isTranscribing && styles.micButtonProcessing,
            ]}
            onPress={() => void toggleVoice()}
            disabled={isTranscribing}
            accessibilityRole="button"
            accessibilityLabel={
              isListening
                ? 'Detener micrófono y enviar voz'
                : isTranscribing
                ? 'Procesando tu voz'
                : 'Toca para hablar'
            }
          >
            {isTranscribing ? (
              <ActivityIndicator size="large" color={Colors.onPrimary} />
            ) : (
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={54}
                color={Colors.onPrimary}
              />
            )}
            <Text style={styles.micButtonText}>
              {isTranscribing
                ? 'Entendiendo...'
                : isListening
                ? usesTapToStopRecording
                  ? 'Toca para enviar'
                  : 'Escuchando...'
                : 'Toca para hablar'}
            </Text>
          </Pressable>

          {(isListening || isTranscribing) && (
            <View style={styles.voiceStatusPill}>
              <Ionicons name="pulse" size={18} color={Colors.onSecondaryContainer} />
              <Text style={styles.voiceStatusText}>
                {isTranscribing
                  ? 'Transcribiendo tu voz...'
                  : usesTapToStopRecording
                  ? 'Grabando... habla y toca el botón para enviar'
                  : 'Escuchando tu voz...'}
              </Text>
            </View>
          )}
        </View>

        {feedback ? (
          <View style={styles.feedbackBanner}>
            <Ionicons name="information-circle" size={20} color={Colors.secondary} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {/* Extraer guía funcional desde páginas oficiales */}
        <View style={styles.webCard}>
          <View style={styles.visionHeader}>
            <View style={[styles.visionIconBox, { backgroundColor: Colors.primary }]}>
              <Ionicons name="globe-outline" size={24} color={Colors.onPrimary} />
            </View>
            <View style={styles.visionHeaderText}>
              <Text style={styles.visionTitle}>Guía desde página oficial (gob.mx)</Text>
              <Text style={styles.visionSubtitle}>
                Toca un portal o pega un enlace para extraer requisitos y pasos interactivos
                guardados offline.
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.portalChipsRow}
          >
            {OFFICIAL_TRAMITE_SOURCES.map((portal) => (
              <Pressable
                key={portal.id}
                style={styles.portalChip}
                onPress={() => handleOpenWebSource(portal.url, `Guía de ${portal.label}`)}
                accessibilityRole="button"
              >
                <Ionicons name="open-outline" size={15} color={Colors.onPrimaryFixed} />
                <Text style={styles.portalChipText}>{portal.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="O pega una URL (ej. gob.mx/tramites...)"
              placeholderTextColor={Colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={() => handleOpenWebSource(customUrl)}
            />
            <Pressable
              style={styles.urlGoBtn}
              onPress={() => handleOpenWebSource(customUrl)}
              accessibilityRole="button"
              accessibilityLabel="Extraer guía desde URL"
            >
              <Text style={styles.urlGoText}>Extraer</Text>
            </Pressable>
          </View>
        </View>

        {/* Tarjeta destacada: Lectura de documentos con Gemini Vision */}
        <View style={styles.visionCard}>
          <View style={styles.visionHeader}>
            <View style={styles.visionIconBox}>
              <Ionicons name="sparkles" size={24} color={Colors.onPrimary} />
            </View>
            <View style={styles.visionHeaderText}>
              <Text style={styles.visionTitle}>Leer documento o aviso con foto</Text>
              <Text style={styles.visionSubtitle}>
                Gemini analiza recetas, citas, volantes o convocatorias y te los explica con voz
                clara.
              </Text>
            </View>
          </View>

          <View style={styles.visionActions}>
            {Platform.OS !== 'web' ? (
              <Pressable
                style={styles.visionPrimaryBtn}
                onPress={() => void handleScanDocument('camera')}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto de documento"
              >
                <Ionicons name="camera" size={20} color={Colors.onPrimary} />
                <Text style={styles.visionPrimaryText}>Tomar foto</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={Platform.OS === 'web' ? styles.visionPrimaryBtn : styles.visionSecondaryBtn}
              onPress={() => void handleScanDocument('library')}
              accessibilityRole="button"
              accessibilityLabel="Elegir imagen de documento"
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={Platform.OS === 'web' ? Colors.onPrimary : Colors.primary}
              />
              <Text
                style={
                  Platform.OS === 'web' ? styles.visionPrimaryText : styles.visionSecondaryText
                }
              >
                {Platform.OS === 'web' ? 'Subir foto de documento' : 'Galería'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Categorías rápidas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías rápidas (offline)</Text>
        </View>

        <View style={styles.categoriesList}>
          {/* Salud */}
          <Pressable
            style={styles.categoryCard}
            onPress={() => handleCategoryPress('salud', 'Quiero sacar una cita médica en el IMSS')}
            accessibilityRole="button"
          >
            <View style={[styles.catIconBox, { backgroundColor: Colors.secondaryContainer }]}>
              <Ionicons name="medical" size={30} color={Colors.onSecondaryContainer} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.catTitle}>Salud</Text>
              <Text style={styles.catSubtitle}>Citas médicas y cartillas</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
          </Pressable>

          {/* Educación */}
          <Pressable
            style={styles.categoryCard}
            onPress={() =>
              handleCategoryPress(
                'educacion',
                'Cómo tramitar constancia de estudios o certificado SEP'
              )
            }
            accessibilityRole="button"
          >
            <View style={[styles.catIconBox, { backgroundColor: Colors.primaryFixed }]}>
              <Ionicons name="school" size={30} color={Colors.onPrimaryFixed} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.catTitle}>Educación</Text>
              <Text style={styles.catSubtitle}>Escuelas y constancias</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
          </Pressable>

          {/* Becas */}
          <Pressable
            style={styles.categoryCard}
            onPress={() =>
              handleCategoryPress(
                'becas',
                'Quiero información sobre la beca Benito Juárez o Rita Cetina'
              )
            }
            accessibilityRole="button"
          >
            <View style={[styles.catIconBox, { backgroundColor: Colors.tertiaryFixed }]}>
              <Ionicons name="ribbon" size={30} color={Colors.onTertiaryFixedVariant} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.catTitle}>Becas</Text>
              <Text style={styles.catSubtitle}>Convocatorias vigentes</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
          </Pressable>
        </View>

        {/* Barra de entrada de texto */}
        <View style={styles.textInputSection}>
          <Text style={styles.inputLabel}>¿Prefieres escribir?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Escribe cualquier trámite (ej. pasaporte, CURP, IMSS)..."
              placeholderTextColor={Colors.onSurfaceVariant}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />
            <Pressable
              style={styles.sendButton}
              onPress={handleSendText}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensaje"
            >
              <Ionicons name="send" size={22} color={Colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Drawer del tablón de avisos */}
      <NoticeDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        meshNodesCount={meshStats.connectedPeers}
      />
    </KeyboardAvoidingView>
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
  meshPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.secondary,
  },
  meshPillText: {
    ...Typography.labelSm,
    fontSize: 13,
    color: Colors.onSecondaryContainer,
    flexShrink: 1,
  },
  titleSection: {
    gap: 4,
  },
  mainTitle: {
    ...Typography.headlineLg,
    color: Colors.onSurface,
  },
  subTitle: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
  },
  micSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    position: 'relative',
  },
  waveOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 46, 57, 0.06)',
  },
  waveInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(0, 46, 57, 0.1)',
  },
  micButton: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    gap: 6,
  },
  micButtonActive: {
    backgroundColor: Colors.error,
  },
  micButtonProcessing: {
    backgroundColor: Colors.secondary,
  },
  micButtonText: {
    ...Typography.labelMd,
    fontSize: 14,
    color: Colors.onPrimary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  voiceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    marginTop: 14,
  },
  voiceStatusText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  webCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 12,
  },
  portalChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  portalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: Colors.primaryFixed,
  },
  portalChipText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryFixed,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.onSurface,
  },
  urlGoBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlGoText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
  visionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    gap: 12,
  },
  visionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  visionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visionHeaderText: {
    flex: 1,
    gap: 3,
  },
  visionTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.primary,
  },
  visionSubtitle: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  visionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  visionPrimaryBtn: {
    flex: 1.2,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  visionPrimaryText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
  visionSecondaryBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  visionSecondaryText: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  feedbackText: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    flex: 1,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  categoriesList: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  catIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTextCol: {
    flex: 1,
  },
  catTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
  },
  catSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  textInputSection: {
    gap: 8,
    marginTop: 6,
  },
  inputLabel: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.onSurface,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

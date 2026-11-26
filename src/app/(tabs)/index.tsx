import React, { useState } from 'react';
import {
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
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { pickDocumentImage, DocumentPickMode } from '../../services/documentPicker';
import { kvStore } from '../../services/kvStore';
import { setPendingDocument } from '../../services/pendingDocument';
import { listenSpanishOnce, stopListeningSpanish } from '../../services/speechInput';
import { speakSpanish, stopSpeaking } from '../../services/voiceService';

export default function HomeScreen() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleMicPress = async () => {
    if (isListening) {
      setIsListening(false);
      await stopListeningSpanish();
      await stopSpeaking();
      setFeedback('Micrófono detenido.');
      return;
    }

    setIsListening(true);
    setFeedback('Escuchando tu voz... Di qué trámite necesitas.');
    await stopSpeaking();

    const capture = await listenSpanishOnce();
    setIsListening(false);
    setFeedback(capture.note);

    if (capture.status === 'recognized' && capture.transcript) {
      router.push({
        pathname: '/(tabs)/conversacion',
        params: { prompt: capture.transcript, reqId: String(Date.now()) },
      });
      return;
    }

    const settings = kvStore.getSettings();
    void speakSpanish(capture.note, { rate: settings.speechRate });
  };

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

  const handleSendText = () => {
    const clean = query.trim();
    if (!clean) return;
    setQuery('');
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { prompt: clean, reqId: String(Date.now()) },
    });
  };

  const handleCategoryPress = (category: string, example: string) => {
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { category, prompt: example, reqId: String(Date.now()) },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Inicio" onOpenNotices={() => setDrawerOpen(true)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Etiqueta informativa Red Mesh */}
        <View style={styles.meshPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.meshPillText}>Funcionando sin internet vía catálogo local y Red Mesh</Text>
        </View>

        {/* Título de bienvenida */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>¿En qué trámite te ayudo hoy?</Text>
          <Text style={styles.subTitle}>
            Toca el micrófono para hablar, toma foto a un papel oficial o elige una categoría.
          </Text>
        </View>

        {/* Micrófono grande central con ondas */}
        <View style={styles.micSection}>
          <View style={styles.waveOuter} />
          <View style={styles.waveInner} />
          <Pressable
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={() => void handleMicPress()}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Detener micrófono' : 'Toca para hablar'}
          >
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={54}
              color={Colors.onPrimary}
            />
            <Text style={styles.micButtonText}>
              {isListening ? 'Escuchando...' : 'Toca para hablar'}
            </Text>
          </Pressable>

          {isListening && (
            <View style={styles.voiceStatusPill}>
              <Ionicons name="pulse" size={18} color={Colors.onSecondaryContainer} />
              <Text style={styles.voiceStatusText}>Escuchando tu voz...</Text>
            </View>
          )}
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
                Gemini analiza recetas, citas, volantes o convocatorias y te los explica con voz clara.
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

        {feedback ? (
          <View style={styles.feedbackBanner}>
            <Ionicons name="information-circle" size={20} color={Colors.secondary} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {/* Categorías rápidas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías rápidas</Text>
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
              placeholder="Escribe tu duda o trámite..."
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
      <NoticeDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
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

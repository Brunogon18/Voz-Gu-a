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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { NoticeDrawer } from '../../components/NoticeDrawer';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { speakSpanish, stopSpeaking } from '../../services/voiceService';

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleMicPress = () => {
    if (isListening) {
      setIsListening(false);
      void stopSpeaking();
      return;
    }
    setIsListening(true);
    setFeedback('Escuchando tu voz... Di tu consulta.');
    void speakSpanish('¿En qué trámite te ayudo hoy? Puedes decir por ejemplo cita médica o beca.', {
      onDone: () => setIsListening(false),
    });
  };

  const handleSendText = () => {
    const clean = query.trim();
    if (!clean) return;
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { prompt: clean },
    });
  };

  const handleCategoryPress = (category: string, example: string) => {
    router.push({
      pathname: '/(tabs)/conversacion',
      params: { category, prompt: example },
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
          <Text style={styles.meshPillText}>Funcionando sin internet vía Red Mesh BLE</Text>
        </View>

        {/* Título de bienvenida */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>¿En qué trámite te ayudo hoy?</Text>
          <Text style={styles.subTitle}>
            Toca el micrófono para hablar o elige una categoría.
          </Text>
        </View>

        {/* Micrófono grande central con ondas */}
        <View style={styles.micSection}>
          <View style={styles.waveOuter} />
          <View style={styles.waveInner} />
          <Pressable
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={handleMicPress}
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

        {/* Categorías rápidas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías rápidas</Text>
        </View>

        <View style={styles.categoriesList}>
          {/* Salud */}
          <Pressable
            style={styles.categoryCard}
            onPress={() => handleCategoryPress('salud', 'Quiero sacar una cita médica en el IMSS')}
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
            onPress={() => handleCategoryPress('educacion', 'Cómo tramitar constancia de estudios o certificado SEP')}
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
            onPress={() => handleCategoryPress('becas', 'Quiero información sobre la beca Benito Juárez o Rita Cetina')}
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
            />
            <Pressable
              style={styles.sendButton}
              onPress={handleSendText}
              accessibilityLabel="Enviar mensaje"
            >
              <Ionicons name="send" size={22} color={Colors.onPrimary} />
            </Pressable>
          </View>
          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
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
  sectionHeader: {
    marginTop: 6,
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
    marginTop: 10,
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
  feedbackText: {
    ...Typography.bodySm,
    color: Colors.secondary,
  },
});

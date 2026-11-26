import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoiceGuideResponse } from '../types/vozGuia';
import { AccessibleButton } from './AccessibleButton';

interface StepGuideCardProps {
  guide: VoiceGuideResponse;
  largeText: boolean;
  isSpeaking: boolean;
  onSpeakAll: () => void;
  onStopSpeaking: () => void;
  onSimplify: () => void;
  onSpeakStep: (text: string) => void;
}

export function StepGuideCard({
  guide,
  largeText,
  isSpeaking,
  onSpeakAll,
  onStopSpeaking,
  onSimplify,
  onSpeakStep,
}: StepGuideCardProps) {
  const bodySize = largeText ? 18 : 15;
  const headingSize = largeText ? 22 : 19;

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>
          {guide.source === 'gemini'
            ? `Gemini (${guide.modelUsed ?? 'AI Studio'})`
            : guide.source === 'mesh-peer'
            ? 'Recibido vía Red Mesh'
            : 'Guía Local Offline'}
        </Text>
      </View>

      <Text style={[styles.title, { fontSize: headingSize }]}>{guide.title}</Text>
      <Text style={[styles.body, { fontSize: bodySize }]}>{guide.simpleAnswer}</Text>

      <View style={styles.audioControls}>
        <AccessibleButton
          label={isSpeaking ? 'Detener voz' : 'Escuchar guía'}
          variant={isSpeaking ? 'danger' : 'primary'}
          onPress={isSpeaking ? onStopSpeaking : onSpeakAll}
          style={styles.flexButton}
        />
        <AccessibleButton
          label="Más sencillo"
          variant="outline"
          onPress={onSimplify}
          style={styles.flexButton}
        />
      </View>

      {guide.requirements.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: bodySize + 1 }]}>
            Documentos que necesitas:
          </Text>
          {guide.requirements.map((req, index) => (
            <Text key={`${req}-${index}`} style={[styles.bullet, { fontSize: bodySize - 1 }]}>
              • {req}
            </Text>
          ))}
        </View>
      )}

      {guide.steps.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: bodySize + 1 }]}>
            Pasos a seguir:
          </Text>
          {guide.steps.map((step) => (
            <View key={step.order} style={styles.stepBox}>
              <Text style={[styles.stepTitle, { fontSize: bodySize }]}>
                Paso {step.order}: {step.title}
              </Text>
              <Text style={[styles.stepBody, { fontSize: bodySize - 1 }]}>
                {step.instruction}
              </Text>
              <AccessibleButton
                label={`Escuchar paso ${step.order}`}
                variant="secondary"
                onPress={() =>
                  onSpeakStep(`Paso ${step.order}: ${step.title}. ${step.instruction}`)
                }
                style={styles.stepButton}
              />
            </View>
          ))}
        </View>
      )}

      {guide.closingTip ? (
        <View style={styles.tipBox}>
          <Text style={[styles.tipText, { fontSize: bodySize - 1 }]}>
            Consejo: {guide.closingTip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D6E2DF',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#EAF2FA',
    color: '#134E8E',
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  title: {
    fontWeight: '800',
    color: '#102A24',
  },
  body: {
    lineHeight: 26,
    color: '#223A34',
  },
  audioControls: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0B5D4B',
  },
  bullet: {
    color: '#203630',
    lineHeight: 24,
    paddingLeft: 4,
  },
  stepBox: {
    backgroundColor: '#F5FAF8',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D5EBE4',
    gap: 6,
  },
  stepTitle: {
    fontWeight: '800',
    color: '#102A24',
  },
  stepBody: {
    color: '#243C36',
    lineHeight: 24,
  },
  stepButton: {
    marginTop: 6,
    minHeight: 48,
  },
  tipBox: {
    backgroundColor: '#FFF8E6',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3D899',
  },
  tipText: {
    color: '#5C4108',
    lineHeight: 22,
    fontWeight: '600',
  },
});

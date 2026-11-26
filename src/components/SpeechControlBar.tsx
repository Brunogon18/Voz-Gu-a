import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSpeechStatus } from '../hooks/useSpeechStatus';
import {
  pauseSpeaking,
  resumeSpeaking,
  stopSpeaking,
} from '../services/voiceService';
import { Colors, Typography } from '../theme/tokens';

interface SpeechControlBarProps {
  /** Use floating mode above the bottom tab bar, or inline inside modals/drawers */
  variant?: 'floating' | 'inline';
}

export function SpeechControlBar({ variant = 'floating' }: SpeechControlBarProps) {
  const speech = useSpeechStatus();

  if (speech.status === 'idle') {
    return null;
  }

  const isPaused = speech.status === 'paused';
  const progressText =
    speech.totalChunks > 1
      ? `${Math.min(speech.currentChunk + 1, speech.totalChunks)}/${speech.totalChunks}`
      : '';

  return (
    <View
      style={[
        styles.container,
        variant === 'floating' ? styles.floating : styles.inline,
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.infoRow}>
        <View style={[styles.dot, isPaused ? styles.dotPaused : styles.dotSpeaking]} />
        <View style={styles.textCol}>
          <Text style={styles.statusText} numberOfLines={1}>
            {isPaused ? 'Audio en pausa' : 'Hablando...'}
            {progressText ? ` (${progressText})` : ''}
          </Text>
          {speech.label ? (
            <Text style={styles.labelText} numberOfLines={1}>
              {speech.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.pauseBtn]}
          onPress={() => {
            if (isPaused) {
              void resumeSpeaking();
            } else {
              void pauseSpeaking();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Reanudar audio' : 'Pausar audio'}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={18}
            color={Colors.onPrimaryFixed}
          />
          <Text style={styles.pauseBtnText}>{isPaused ? 'Reanudar' : 'Pausar'}</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.stopBtn]}
          onPress={() => void stopSpeaking()}
          accessibilityRole="button"
          accessibilityLabel="Detener audio"
        >
          <Ionicons name="stop" size={18} color={Colors.onError} />
          <Text style={styles.stopBtnText}>Detener</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  floating: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 78,
    zIndex: 50,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  inline: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotSpeaking: {
    backgroundColor: '#5EEAD4',
  },
  dotPaused: {
    backgroundColor: '#FDE68A',
  },
  textCol: {
    flex: 1,
  },
  statusText: {
    ...Typography.labelMd,
    fontSize: 13,
    color: Colors.onPrimary,
  },
  labelText: {
    ...Typography.bodySm,
    fontSize: 12,
    color: Colors.primaryFixed,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  pauseBtn: {
    backgroundColor: Colors.primaryFixed,
  },
  pauseBtnText: {
    ...Typography.labelMd,
    fontSize: 13,
    color: Colors.onPrimaryFixed,
  },
  stopBtn: {
    backgroundColor: Colors.error,
  },
  stopBtnText: {
    ...Typography.labelMd,
    fontSize: 13,
    color: Colors.onError,
  },
});

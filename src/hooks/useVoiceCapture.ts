import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { hasNativeSpeechModule } from '../native/androidBridge';
import { transcribeAudioWithGemini } from '../services/geminiService';
import { kvStore } from '../services/kvStore';
import { listenSpanishOnce, stopListeningSpanish } from '../services/speechInput';
import { stopSpeaking } from '../services/voiceService';

function hasWebSpeechRecognition(): boolean {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return false;
  const g = globalThis as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(g.SpeechRecognition || g.webkitSpeechRecognition);
}

async function readAudioUriAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'audio/webm';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('No se pudo leer el audio grabado'));
        }
      };
      reader.onerror = () => reject(new Error('Error leyendo audio'));
      reader.readAsDataURL(blob);
    });
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return { base64, mimeType };
  }

  const audioFile = new File(uri);
  const base64 = await audioFile.base64();
  const lower = uri.toLowerCase();
  const mimeType = lower.endsWith('.webm')
    ? 'audio/webm'
    : lower.endsWith('.wav')
    ? 'audio/wav'
    : lower.endsWith('.3gp')
    ? 'audio/3gpp'
    : 'audio/mp4';

  return { base64, mimeType };
}

export interface UseVoiceCaptureOptions {
  onTranscript: (transcript: string) => void | Promise<void>;
  onFeedback?: (message: string) => void;
}

export function useVoiceCapture({ onTranscript, onFeedback }: UseVoiceCaptureOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const activeModeRef = useRef<'none' | 'native-or-web-stt' | 'expo-audio'>('none');

  const notify = useCallback(
    (msg: string) => {
      onFeedback?.(msg);
    },
    [onFeedback]
  );

  const toggleVoice = useCallback(async () => {
    if (isTranscribing) return;

    // Stop active session
    if (isListening) {
      if (activeModeRef.current === 'expo-audio') {
        setIsListening(false);
        setIsTranscribing(true);
        notify('Procesando tu voz...');
        try {
          await recorder.stop();
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          });
          const uri = recorder.uri;
          activeModeRef.current = 'none';

          if (!uri) {
            notify('No se obtuvo audio de la grabación. Intenta de nuevo.');
            return;
          }

          const settings = kvStore.getSettings();
          if (!settings.geminiApiKey.trim()) {
            notify(
              'Micrófono funcionando, pero en Expo Go necesitas guardar tu API Key gratuita de Gemini en Ajustes para transcribir voz (en el APK nativo funciona sin internet).'
            );
            return;
          }

          const { base64, mimeType } = await readAudioUriAsBase64(uri);
          const result = await transcribeAudioWithGemini({
            base64,
            mimeType,
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel,
          });

          if (result.ok && result.transcript) {
            notify(`Escuché: "${result.transcript}"`);
            await onTranscript(result.transcript);
          } else {
            notify(result.error || 'No se pudo transcribir el audio.');
          }
        } catch {
          notify('No se pudo detener o procesar la grabación. Intenta de nuevo.');
        } finally {
          activeModeRef.current = 'none';
          setIsTranscribing(false);
        }
        return;
      }

      setIsListening(false);
      activeModeRef.current = 'none';
      await stopListeningSpanish();
      await stopSpeaking();
      notify('Micrófono detenido.');
      return;
    }

    // Start listening
    await stopSpeaking();

    // 1. Native Android APK STT OR Web Speech API (instant, no API key needed)
    if (hasNativeSpeechModule() || hasWebSpeechRecognition()) {
      activeModeRef.current = 'native-or-web-stt';
      setIsListening(true);
      notify('Escuchando tu voz... Di tu consulta ahora.');

      const capture = await listenSpanishOnce();
      activeModeRef.current = 'none';
      setIsListening(false);
      notify(capture.note);

      if (capture.status === 'recognized' && capture.transcript) {
        await onTranscript(capture.transcript);
      }
      return;
    }

    // 2. Expo Go (Android/iOS) or browsers without SpeechRecognition: real mic recording via expo-audio + Gemini transcription
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        notify('Activa el permiso de micrófono para hablar con Voz Guía.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();

      activeModeRef.current = 'expo-audio';
      setIsListening(true);
      notify('Grabando tu voz... Habla ahora y toca de nuevo el micrófono para enviar.');
    } catch {
      activeModeRef.current = 'none';
      setIsListening(false);
      notify('No se pudo activar el micrófono en este dispositivo. Puedes escribir tu duda abajo.');
    }
  }, [isListening, isTranscribing, notify, onTranscript, recorder]);

  return {
    isListening,
    isTranscribing,
    toggleVoice,
    usesTapToStopRecording: !hasNativeSpeechModule() && !hasWebSpeechRecognition(),
  };
}

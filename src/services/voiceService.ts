import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import {
  buildSpeechScript,
  detectSpeechControlCommand,
  SpeechControlCommand,
  splitTextIntoSpeechChunks,
} from './speechUtils';

export {
  buildSpeechScript,
  detectSpeechControlCommand,
  splitTextIntoSpeechChunks,
};
export type { SpeechControlCommand };

export type SpeechPlaybackStatus = 'idle' | 'speaking' | 'paused';

export interface SpeechState {
  status: SpeechPlaybackStatus;
  sourceId: string | null;
  label: string;
  currentChunk: number;
  totalChunks: number;
}

export interface SpeakSpanishOptions {
  rate?: number;
  sourceId?: string;
  label?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
}

const INITIAL_STATE: SpeechState = {
  status: 'idle',
  sourceId: null,
  label: '',
  currentChunk: 0,
  totalChunks: 0,
};

let currentState: SpeechState = { ...INITIAL_STATE };
let sessionId = 0;
let chunks: string[] = [];
let currentChunkIndex = 0;
let currentRate = 0.92;
let activeCallbacks: Pick<SpeakSpanishOptions, 'onStart' | 'onDone' | 'onError'> | null = null;
let activeWebUtterance: SpeechSynthesisUtterance | null = null;

const listeners = new Set<() => void>();
let webUnloadBound = false;

function bindWebUnloadCleanup(): void {
  if (webUnloadBound || Platform.OS !== 'web' || typeof window === 'undefined') return;
  webUnloadBound = true;
  const handleUnload = () => {
    cancelPlatformSpeechSync();
  };
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
}

function emitState(next: SpeechState): void {
  currentState = next;
  listeners.forEach((listener) => listener());
}

export function getSpeechState(): SpeechState {
  return currentState;
}

export function subscribeSpeechState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getWebSpeechSynthesis(): SpeechSynthesis | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

function pickSpanishWebVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  try {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    const mx = voices.find((v) => v.lang.toLowerCase() === 'es-mx');
    if (mx) return mx;
    const esLatam = voices.find((v) => /^es-(mx|us|419|co|ar|cl|pe)$/i.test(v.lang));
    if (esLatam) return esLatam;
    const anyEs = voices.find((v) => v.lang.toLowerCase().startsWith('es'));
    return anyEs ?? null;
  } catch {
    return null;
  }
}

function clearWebUtteranceHandlers(): void {
  if (!activeWebUtterance) return;
  activeWebUtterance.onstart = null;
  activeWebUtterance.onend = null;
  activeWebUtterance.onerror = null;
  activeWebUtterance.onpause = null;
  activeWebUtterance = null;
}

function cancelPlatformSpeechSync(): void {
  clearWebUtteranceHandlers();

  const synth = getWebSpeechSynthesis();
  if (synth) {
    try {
      // Chromium/Edge quirk: cancel() can stall if synthesis is currently paused
      if (synth.paused) {
        synth.resume();
      }
      synth.cancel();
    } catch {
      // ignore web synthesis cancel errors
    }
    return;
  }

  void Speech.stop().catch(() => {
    // ignore native stop errors
  });
}

async function cancelPlatformSpeechAsync(): Promise<void> {
  clearWebUtteranceHandlers();

  const synth = getWebSpeechSynthesis();
  if (synth) {
    try {
      if (synth.paused) {
        synth.resume();
      }
      synth.cancel();
    } catch {
      // ignore
    }
    return;
  }

  try {
    await Speech.stop();
  } catch {
    // ignore
  }
}

function finishSession(expectedSessionId: number, notifyDone: boolean): void {
  if (expectedSessionId !== sessionId) return;
  const callbacks = activeCallbacks;
  clearWebUtteranceHandlers();
  chunks = [];
  currentChunkIndex = 0;
  activeCallbacks = null;
  emitState({ ...INITIAL_STATE });
  if (notifyDone) {
    callbacks?.onDone?.();
  }
}

function speakChunkAt(index: number, expectedSessionId: number): void {
  if (expectedSessionId !== sessionId) return;

  if (index >= chunks.length) {
    finishSession(expectedSessionId, true);
    return;
  }

  currentChunkIndex = index;
  emitState({
    ...currentState,
    status: 'speaking',
    currentChunk: index,
    totalChunks: chunks.length,
  });

  const textChunk = chunks[index];
  const synth = getWebSpeechSynthesis();

  if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
    clearWebUtteranceHandlers();
    const utterance = new SpeechSynthesisUtterance(textChunk);
    utterance.lang = 'es-MX';
    utterance.rate = currentRate;
    utterance.pitch = 1.0;

    const voice = pickSpanishWebVoice(synth);
    if (voice) {
      utterance.voice = voice;
    }

    // Hold module-level reference so Chromium GC does not drop onend callbacks
    activeWebUtterance = utterance;

    utterance.onstart = () => {
      if (expectedSessionId !== sessionId) return;
      if (index === 0) {
        activeCallbacks?.onStart?.();
      }
    };

    utterance.onend = () => {
      if (expectedSessionId !== sessionId) return;
      speakChunkAt(index + 1, expectedSessionId);
    };

    utterance.onerror = (event) => {
      if (expectedSessionId !== sessionId) return;
      const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error;
      if (errCode === 'canceled' || errCode === 'interrupted') {
        return;
      }
      const callbacks = activeCallbacks;
      finishSession(expectedSessionId, false);
      callbacks?.onError?.();
    };

    try {
      synth.speak(utterance);
    } catch {
      const callbacks = activeCallbacks;
      finishSession(expectedSessionId, false);
      callbacks?.onError?.();
    }
    return;
  }

  Speech.speak(textChunk, {
    language: 'es-MX',
    rate: currentRate,
    pitch: 1.0,
    onStart: () => {
      if (expectedSessionId !== sessionId) return;
      if (index === 0) {
        activeCallbacks?.onStart?.();
      }
    },
    onDone: () => {
      if (expectedSessionId !== sessionId) return;
      speakChunkAt(index + 1, expectedSessionId);
    },
    onStopped: () => {
      if (expectedSessionId !== sessionId) return;
      finishSession(expectedSessionId, true);
    },
    onError: () => {
      if (expectedSessionId !== sessionId) return;
      const callbacks = activeCallbacks;
      finishSession(expectedSessionId, false);
      callbacks?.onError?.();
    },
  });
}

export async function speakSpanish(
  text: string,
  options?: SpeakSpanishOptions
): Promise<void> {
  bindWebUnloadCleanup();
  const nextChunks = splitTextIntoSpeechChunks(text);
  if (nextChunks.length === 0) {
    await stopSpeaking();
    return;
  }

  // Invalidate any previous speech session BEFORE stopping platform TTS
  sessionId += 1;
  const mySessionId = sessionId;

  await cancelPlatformSpeechAsync();
  if (mySessionId !== sessionId) {
    // User pressed pause/stop while waiting for previous Speech.stop()
    return;
  }

  chunks = nextChunks;
  currentChunkIndex = 0;
  currentRate = options?.rate ?? 0.92;
  activeCallbacks = options
    ? {
        onStart: options.onStart,
        onDone: options.onDone,
        onError: options.onError,
      }
    : null;

  emitState({
    status: 'speaking',
    sourceId: options?.sourceId ?? null,
    label: options?.label?.trim() || 'Lectura por voz',
    currentChunk: 0,
    totalChunks: nextChunks.length,
  });

  speakChunkAt(0, mySessionId);
}

export async function pauseSpeaking(): Promise<void> {
  if (currentState.status !== 'speaking') {
    cancelPlatformSpeechSync();
    return;
  }

  sessionId += 1;
  emitState({
    ...currentState,
    status: 'paused',
  });
  await cancelPlatformSpeechAsync();
}

export async function resumeSpeaking(): Promise<void> {
  if (currentState.status !== 'paused' || chunks.length === 0) return;

  sessionId += 1;
  const mySessionId = sessionId;

  await cancelPlatformSpeechAsync();
  if (mySessionId !== sessionId) return;

  emitState({
    ...currentState,
    status: 'speaking',
  });
  speakChunkAt(currentChunkIndex, mySessionId);
}

export async function togglePauseSpeaking(): Promise<void> {
  if (currentState.status === 'speaking') {
    await pauseSpeaking();
    return;
  }
  if (currentState.status === 'paused') {
    await resumeSpeaking();
  }
}

export async function stopSpeaking(): Promise<void> {
  sessionId += 1;
  chunks = [];
  currentChunkIndex = 0;
  activeCallbacks = null;
  emitState({ ...INITIAL_STATE });
  await cancelPlatformSpeechAsync();
}

export async function executeSpeechCommand(command: SpeechControlCommand): Promise<string> {
  if (command === 'pause') {
    if (currentState.status === 'speaking') {
      await pauseSpeaking();
      return 'Audio en pausa. Toca Reanudar cuando quieras seguir escuchando.';
    }
    await stopSpeaking();
    return 'Audio en pausa.';
  }

  if (command === 'stop') {
    await stopSpeaking();
    return 'Audio detenido.';
  }

  if (currentState.status === 'paused') {
    await resumeSpeaking();
    return 'Reanudando el audio...';
  }
  return 'No hay ningún audio en pausa para reanudar.';
}

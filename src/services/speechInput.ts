import { Platform } from 'react-native';
import {
  hasNativeSpeechModule,
  recognizeSpeechOnce,
  requestAndroidRuntimePermissions,
  stopNativeSpeech,
} from '../native/androidBridge';

interface WebSpeechRecognitionEvent {
  results?: {
    [index: number]: {
      [index: number]: {
        transcript?: string;
      };
    };
  };
}

interface WebSpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type WebSpeechRecognitionCtor = new () => WebSpeechRecognitionInstance;

let activeWebRecognition: WebSpeechRecognitionInstance | null = null;

function getWebSpeechRecognitionCtor(): WebSpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    SpeechRecognition?: WebSpeechRecognitionCtor;
    webkitSpeechRecognition?: WebSpeechRecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export interface SpeechCaptureResult {
  status: 'recognized' | 'empty' | 'denied' | 'unavailable';
  transcript: string;
  note: string;
}

export async function listenSpanishOnce(): Promise<SpeechCaptureResult> {
  if (Platform.OS === 'web') {
    const Ctor = getWebSpeechRecognitionCtor();
    if (!Ctor) {
      return {
        status: 'unavailable',
        transcript: '',
        note: 'Este navegador no soporta dictado por voz. Escribe tu duda abajo o sube una foto del documento.',
      };
    }

    return new Promise<SpeechCaptureResult>((resolve) => {
      let settled = false;
      const recognition = new Ctor();
      activeWebRecognition = recognition;
      recognition.lang = 'es-MX';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const finish = (result: SpeechCaptureResult) => {
        if (settled) return;
        settled = true;
        activeWebRecognition = null;
        resolve(result);
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
        if (transcript) {
          finish({ status: 'recognized', transcript, note: `Escuché: "${transcript}"` });
        } else {
          finish({
            status: 'empty',
            transcript: '',
            note: 'No alcancé a escuchar tu consulta. Intenta hablar más cerca o escríbela abajo.',
          });
        }
      };

      recognition.onerror = () => {
        finish({
          status: 'empty',
          transcript: '',
          note: 'No pude activar el micrófono del navegador. Revisa el permiso o escribe tu consulta.',
        });
      };

      recognition.onend = () => {
        finish({
          status: 'empty',
          transcript: '',
          note: 'Dictado finalizado sin texto. Puedes intentar de nuevo o escribir abajo.',
        });
      };

      try {
        recognition.start();
      } catch {
        finish({
          status: 'unavailable',
          transcript: '',
          note: 'No se pudo iniciar el dictado. Escribe tu consulta abajo.',
        });
      }
    });
  }

  const perms = await requestAndroidRuntimePermissions();
  if (!perms.audioGranted) {
    return {
      status: 'denied',
      transcript: '',
      note: 'Activa el permiso de micrófono para dictar tu consulta.',
    };
  }

  if (!hasNativeSpeechModule()) {
    return {
      status: 'unavailable',
      transcript: '',
      note: 'En Expo Go el dictado nativo Android no está vinculado: escribe tu duda, elige una categoría o toma foto de un documento.',
    };
  }

  try {
    const recognized = (await recognizeSpeechOnce('es-MX'))?.trim() ?? '';
    if (!recognized) {
      return {
        status: 'empty',
        transcript: '',
        note: 'No alcancé a escuchar tu consulta. Intenta hablar de nuevo o escríbela abajo.',
      };
    }
    return { status: 'recognized', transcript: recognized, note: `Escuché: "${recognized}"` };
  } catch {
    return {
      status: 'empty',
      transcript: '',
      note: 'Hubo un problema con el micrófono. Escribe tu consulta abajo.',
    };
  }
}

export async function stopListeningSpanish(): Promise<void> {
  if (activeWebRecognition) {
    try {
      activeWebRecognition.stop();
    } catch {
      // ignore
    }
    activeWebRecognition = null;
  }
  await stopNativeSpeech();
}

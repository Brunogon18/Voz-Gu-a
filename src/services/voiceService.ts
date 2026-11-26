import * as Speech from 'expo-speech';
import { VoiceGuideResponse } from '../types/vozGuia';

export function buildSpeechScript(guide: VoiceGuideResponse, simplify = false): string {
  const parts: string[] = [guide.greeting, guide.simpleAnswer];

  if (guide.requirements.length > 0) {
    parts.push(`Vas a necesitar: ${guide.requirements.join('. ')}.`);
  }

  if (guide.steps.length > 0) {
    parts.push('Sigue estos pasos:');
    for (const step of guide.steps) {
      const detail = simplify ? step.simpleExplanation : step.instruction;
      parts.push(`Paso ${step.order}: ${step.title}. ${detail}`);
    }
  }

  if (guide.closingTip) {
    parts.push(guide.closingTip);
  }

  return parts.join(' ');
}

export async function speakSpanish(
  text: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onDone?: () => void;
    onError?: () => void;
  }
): Promise<void> {
  await Speech.stop();
  Speech.speak(text, {
    language: 'es-MX',
    rate: options?.rate ?? 0.92,
    pitch: 1.0,
    onStart: options?.onStart,
    onDone: options?.onDone,
    onStopped: options?.onDone,
    onError: options?.onError,
  });
}

export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

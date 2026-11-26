import { VoiceGuideResponse } from '../types/vozGuia';

export type SpeechControlCommand = 'pause' | 'stop' | 'resume';

export function buildSpeechScript(guide: VoiceGuideResponse, simplify = false): string {
  const parts: string[] = [guide.greeting, guide.simpleAnswer];

  if (guide.importantDates && guide.importantDates.length > 0) {
    parts.push(`Datos y fechas importantes: ${guide.importantDates.join('. ')}.`);
  }

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

  return parts.filter(Boolean).join(' ');
}

function splitLongSegment(segment: string, maxChunkLength: number): string[] {
  const result: string[] = [];
  let remaining = segment.trim();

  while (remaining.length > maxChunkLength) {
    const slice = remaining.slice(0, maxChunkLength);
    let breakAt = Math.max(slice.lastIndexOf('; '), slice.lastIndexOf(', '));
    if (breakAt < Math.floor(maxChunkLength * 0.45)) {
      breakAt = slice.lastIndexOf(' ');
    }
    if (breakAt <= 0) {
      breakAt = maxChunkLength;
    } else {
      breakAt += 1;
    }

    const head = remaining.slice(0, breakAt).trim();
    if (head) result.push(head);
    remaining = remaining.slice(breakAt).trim();
  }

  if (remaining) {
    result.push(remaining);
  }

  return result;
}

/**
 * Splits a long TTS script into natural sentence-sized chunks so that:
 * 1. Pause/Resume works reliably across Web, Android, and iOS (Android lacks native Speech.pause()).
 * 2. Chrome/Edge Web SpeechSynthesis never hits its ~15-second long-utterance freeze bug.
 */
export function splitTextIntoSpeechChunks(text: string, maxChunkLength = 180): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const rawSentences = normalized.match(/[^.!?]+[.!?]*\s*/g) ?? [normalized];
  const chunks: string[] = [];

  for (const raw of rawSentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (sentence.length > maxChunkLength) {
      chunks.push(...splitLongSegment(sentence, maxChunkLength));
      continue;
    }

    const prev = chunks[chunks.length - 1];
    if (prev && prev.length < 48 && prev.length + 1 + sentence.length <= maxChunkLength) {
      chunks[chunks.length - 1] = `${prev} ${sentence}`;
    } else {
      chunks.push(sentence);
    }
  }

  return chunks;
}

function normalizeCommandText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAUSE_PATTERNS = [
  /\bpausa\b/,
  /\bpausar\b/,
  /\bpausalo\b/,
  /\bpausala\b/,
  /\bpausate\b/,
  /\bpause\b/,
  /\bpauses\b/,
  /\bespera\b/,
  /\besperame\b/,
  /\bun momento\b/,
];

const STOP_PATTERNS = [
  /\bdetener\b/,
  /\bdetente\b/,
  /\bdeten\b/,
  /\bdetenlo\b/,
  /\bpara\b/,
  /\bparar\b/,
  /\bparalo\b/,
  /\balto\b/,
  /\bsilencio\b/,
  /\bcallate\b/,
  /\bcalla\b/,
  /\bdeja de hablar\b/,
  /\bya no hables\b/,
  /\bno hables\b/,
  /\bapaga la voz\b/,
  /\bapagar audio\b/,
  /\bquitar audio\b/,
  /\bcancelar audio\b/,
  /\bstop\b/,
  /\bmute\b/,
];

const RESUME_PATTERNS = [
  /\breanudar\b/,
  /\breanuda\b/,
  /\bcontinua\b/,
  /\bcontinuar\b/,
  /\bsigue\b/,
  /\bsigue hablando\b/,
  /\bseguir hablando\b/,
  /\bresume\b/,
];

/**
 * Detects short spoken or typed commands to pause, stop, or resume TTS playback.
 * Ignores longer questions so real trámite queries are never intercepted.
 */
export function detectSpeechControlCommand(text: string): SpeechControlCommand | null {
  const normalized = normalizeCommandText(text);
  if (!normalized || normalized.length > 48) return null;

  const words = normalized.split(' ');
  if (words.length > 7) return null;

  // Avoid catching trámite questions like "para que sirve..." or "cita para..."
  if (
    /\b(tramite|beca|cita|imss|issste|sep|curp|acta|documento|escuela|medico|doctor|salud|hospital|pension|bienestar)\b/.test(
      normalized
    )
  ) {
    return null;
  }

  if (PAUSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'pause';
  }
  if (STOP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'stop';
  }
  if (RESUME_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'resume';
  }

  return null;
}

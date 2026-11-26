import { SearchResult, TramiteRecord, VoiceGuideResponse } from '../types/vozGuia';

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: {
    message?: string;
  };
}

export function buildOfflineGuideResponse(
  query: string,
  tramite: TramiteRecord | null,
  options?: { simplify?: boolean; source?: 'offline-local' | 'mesh-peer'; hopCount?: number }
): VoiceGuideResponse {
  const source = options?.source ?? 'offline-local';

  if (!tramite) {
    return {
      title: 'No encontré un trámite exacto',
      greeting: 'Te ayudo con gusto.',
      simpleAnswer:
        `Busqué "${query}" en tu guía local sin internet, pero no encontré coincidencia exacta. Intenta preguntar por: cita médica IMSS, IMSS-Bienestar, beca Benito Juárez, beca Rita Cetina, certificado SEP o constancia de estudios.`,
      requirements: [],
      steps: [],
      closingTip: 'También puedes explorar la pestaña "Trámites" para ver todas las guías disponibles.',
      source,
      hopCount: options?.hopCount,
    };
  }

  const simplify = options?.simplify ?? false;
  return {
    title: tramite.title,
    greeting: `Aquí tienes la guía para: ${tramite.title}.`,
    simpleAnswer: simplify
      ? `${tramite.simpleSummary} Este trámite es ante ${tramite.institution} y tiene un costo: ${tramite.cost}.`
      : `${tramite.summary} Institución: ${tramite.institution}. Canal oficial: ${tramite.officialChannel}.`,
    requirements: tramite.requirements,
    steps: tramite.steps.map((step) => ({
      ...step,
      instruction: simplify ? step.simpleExplanation : step.instruction,
    })),
    closingTip: `Tiempo aproximado: ${tramite.estimatedTime}. Canal oficial: ${tramite.officialChannel}.`,
    source,
    hopCount: options?.hopCount,
  };
}

export async function generateVoiceGuide(params: {
  query: string;
  searchResults: SearchResult[];
  apiKey?: string;
  model?: string;
  simplify?: boolean;
}): Promise<VoiceGuideResponse> {
  const topMatch = params.searchResults[0]?.tramite ?? null;
  const apiKey = params.apiKey?.trim() ?? '';
  const model = params.model?.trim() || 'gemini-2.5-flash';

  if (!apiKey) {
    return buildOfflineGuideResponse(params.query, topMatch, {
      simplify: params.simplify,
      source: params.searchResults[0]?.source === 'mesh-hop' ? 'mesh-peer' : 'offline-local',
    });
  }

  const contextBlock = params.searchResults
    .slice(0, 2)
    .map(
      (r) =>
        `TRAMITE: ${r.tramite.title} (${r.tramite.institution})\nResumen: ${r.tramite.summary}\nRequisitos: ${r.tramite.requirements.join('; ')}\nPasos: ${r.tramite.steps.map((s) => `${s.order}. ${s.title}: ${s.instruction}`).join(' | ')}\nCanal: ${r.tramite.officialChannel}\nCosto: ${r.tramite.cost}`
    )
    .join('\n---\n');

  const prompt = [
    'Eres Voz Guía, un asistente empático y paciente para adultos mayores, estudiantes y personas con poca experiencia digital en México.',
    params.simplify
      ? 'El usuario pidió que se lo expliques con palabras MUY sencillas, frases cortas y sin tecnicismos.'
      : 'Explica el trámite de forma clara, cálida y fácil de escuchar por voz.',
    `Pregunta del usuario: "${params.query}"`,
    contextBlock ? `Contexto oficial recuperado:\n${contextBlock}` : 'No hubo coincidencia en el catálogo local; responde con orientación general segura y recomienda verificar en ventanilla oficial.',
    'Responde SOLO en JSON válido con esta estructura exacta:',
    '{"title": string, "greeting": string, "simpleAnswer": string, "requirements": string[], "steps": [{"order": number, "title": string, "instruction": string, "simpleExplanation": string}], "closingTip": string}',
  ].join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return buildOfflineGuideResponse(params.query, topMatch, {
        simplify: params.simplify,
        source: 'offline-local',
      });
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return buildOfflineGuideResponse(params.query, topMatch, {
        simplify: params.simplify,
        source: 'offline-local',
      });
    }

    const parsed = JSON.parse(rawText) as Omit<VoiceGuideResponse, 'source' | 'modelUsed'>;
    return {
      title: parsed.title || topMatch?.title || 'Guía de trámite',
      greeting: parsed.greeting || 'Con mucho gusto te explico.',
      simpleAnswer: parsed.simpleAnswer || topMatch?.simpleSummary || '',
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : topMatch?.requirements ?? [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : topMatch?.steps ?? [],
      closingTip: parsed.closingTip || 'Recuerda llevar tus documentos en original y copia.',
      source: 'gemini',
      modelUsed: model,
    };
  } catch {
    return buildOfflineGuideResponse(params.query, topMatch, {
      simplify: params.simplify,
      source: 'offline-local',
    });
  }
}

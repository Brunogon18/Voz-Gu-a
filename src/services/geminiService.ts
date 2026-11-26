import {
  ConversationTurn,
  DocumentImageInput,
  GroundingSource,
  SearchResult,
  TramiteCategory,
  TramiteRecord,
  TramiteStep,
  VoiceGuideResponse,
} from '../types/vozGuia';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface GeminiModelOption {
  id: string;
  label: string;
  description: string;
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'Más rápido y económico (recomendado para voz, web y lectura de documentos)',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: 'Equilibrio entre velocidad y razonamiento multimodal',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    description: 'Máxima precisión en trámites complejos y búsqueda web oficial',
  },
];

const DEPRECATED_MODEL_MAP: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-3.7-flash': 'gemini-3.8-flash',
};

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
    };
    groundingMetadata?: {
      groundingChunks?: GeminiGroundingChunk[];
    };
  }[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const SYSTEM_INSTRUCTION = [
  'Eres Voz Guía, un asistente empático, cálido y paciente para adultos mayores, estudiantes y personas con poca experiencia digital en México.',
  'Tu objetivo es explicar trámites de salud, educación, becas y servicios públicos en México en español claro y fácil de escuchar en voz alta.',
  'Usa frases cortas, evita siglas sin explicar y nunca inventes datos oficiales, fechas, montos o teléfonos que no aparezcan en el contexto, en la página web o en el documento.',
  'Si una parte de un documento es borrosa o falta información en la página, dilo con honestidad y sugiere verificar en la ventanilla oficial.',
].join(' ');

export const VOICE_GUIDE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Título corto y claro del trámite o documento',
    },
    category: {
      type: 'string',
      enum: ['salud', 'educacion', 'becas'],
      description: 'Categoría más cercana del trámite',
    },
    institution: {
      type: 'string',
      description: 'Institución pública responsable (ej. IMSS, SEP, Bienestar, SRE)',
    },
    greeting: {
      type: 'string',
      description: 'Saludo cálido y breve en una frase',
    },
    simpleAnswer: {
      type: 'string',
      description: 'Explicación principal clara, empática y lista para escucharse en voz alta',
    },
    documentDetected: {
      type: 'string',
      description: 'Tipo de documento o aviso identificado si el usuario envió una foto (o cadena vacía)',
    },
    importantDates: {
      type: 'array',
      items: { type: 'string' },
      description: 'Fechas límite, horarios, costos, folios o teléfonos clave encontrados',
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Lista de documentos o requisitos necesarios',
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order: { type: 'integer' },
          title: { type: 'string' },
          instruction: { type: 'string' },
          simpleExplanation: { type: 'string' },
        },
        required: ['order', 'title', 'instruction', 'simpleExplanation'],
      },
      description: 'Pasos ordenados y accionables que la persona debe seguir',
    },
    closingTip: {
      type: 'string',
      description: 'Consejo práctico final o canal oficial (teléfono o sitio web)',
    },
  },
  required: ['title', 'greeting', 'simpleAnswer', 'requirements', 'steps', 'closingTip'],
};

const AUDIO_TRANSCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    transcript: {
      type: 'string',
      description: 'Transcripción literal en español de México de lo que dijo la persona, sin comentarios extra',
    },
  },
  required: ['transcript'],
};

export function resolveGeminiModel(model?: string): string {
  const cleaned = model?.trim() ?? '';
  if (!cleaned) return DEFAULT_GEMINI_MODEL;
  return DEPRECATED_MODEL_MAP[cleaned] ?? cleaned;
}

export function extractBase64FromPickerAsset(asset: {
  base64?: string | null;
  uri?: string | null;
  mimeType?: string | null;
}): { base64: string; mimeType: string } | null {
  let rawBase64 = asset.base64?.trim() ?? '';
  let detectedMime = asset.mimeType?.trim() || 'image/jpeg';

  if (rawBase64.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(rawBase64);
    if (match) {
      detectedMime = match[1] || detectedMime;
      rawBase64 = match[2];
    }
  } else if (!rawBase64 && asset.uri?.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(asset.uri);
    if (match) {
      detectedMime = match[1] || detectedMime;
      rawBase64 = match[2];
    }
  }

  if (!rawBase64) return null;
  return {
    base64: rawBase64.replace(/\s+/g, ''),
    mimeType: detectedMime,
  };
}

function getThinkingLevelForModel(model: string): 'minimal' | 'low' {
  return model.includes('flash-lite') ? 'minimal' : 'low';
}

function sanitizeHistory(
  history?: ConversationTurn[]
): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  if (!history || history.length === 0) return [];
  const recent = history.slice(-6).filter((turn) => turn.text.trim().length > 0);
  const normalized: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const turn of recent) {
    if (normalized.length === 0 && turn.role !== 'user') continue;
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts[0].text = `${prev.parts[0].text}\n${turn.text.trim()}`;
    } else {
      normalized.push({ role: turn.role, parts: [{ text: turn.text.trim() }] });
    }
  }
  return normalized;
}

function extractGroundingSources(
  data: GeminiGenerateContentResponse,
  extraUrl?: string
): GroundingSource[] {
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  if (extraUrl && /^https?:\/\//i.test(extraUrl)) {
    seen.add(extraUrl);
    sources.push({ title: 'Página oficial consultada', url: extraUrl });
  }

  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      title: chunk.web?.title?.trim() || uri,
      url: uri,
    });
  }

  return sources.slice(0, 5);
}

export function buildGenerateContentBody(params: {
  query: string;
  searchResults: SearchResult[];
  model: string;
  simplify?: boolean;
  history?: ConversationTurn[];
  enableWebSearch?: boolean;
}) {
  const contextBlock = params.searchResults
    .slice(0, 2)
    .map(
      (r) =>
        `TRAMITE: ${r.tramite.title} (${r.tramite.institution})\nResumen: ${r.tramite.summary}\nRequisitos: ${r.tramite.requirements.join('; ')}\nPasos: ${r.tramite.steps.map((s) => `${s.order}. ${s.title}: ${s.instruction}`).join(' | ')}\nCanal: ${r.tramite.officialChannel}\nCosto: ${r.tramite.cost}`
    )
    .join('\n---\n');

  const userPrompt = [
    params.simplify
      ? 'El usuario pidió que se lo expliques con palabras MUY sencillas, frases muy cortas y sin tecnicismos.'
      : 'Explica el trámite de forma clara, cálida y fácil de escuchar por voz.',
    `Pregunta del usuario: "${params.query}"`,
    contextBlock
      ? `Contexto oficial del catálogo local:\n${contextBlock}`
      : params.enableWebSearch
      ? 'Busca información oficial actualizada en portales gubernamentales de México (como gob.mx, imss.gob.mx, sep.gob.mx, becasbenitojuarez.gob.mx) y construye una guía paso a paso completa y accionable.'
      : 'No hubo coincidencia exacta en el catálogo local; ofrece orientación general segura para México y recomienda verificar en ventanilla oficial.',
  ].join('\n\n');

  const historyContents = sanitizeHistory(params.history);
  const contents = [
    ...historyContents,
    { role: 'user' as const, parts: [{ text: userPrompt }] },
  ];

  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    ...(params.enableWebSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: VOICE_GUIDE_JSON_SCHEMA,
      thinkingConfig: {
        thinkingLevel: getThinkingLevelForModel(params.model),
      },
    },
  };
}

export function buildWebPageGuideBody(params: {
  url: string;
  pageTitle?: string;
  pageText?: string;
  userQuestion?: string;
  model: string;
  simplify?: boolean;
  useUrlContextTool?: boolean;
}) {
  const promptParts = [
    `Genera una guía práctica paso a paso en español de México basada en esta página web oficial de trámites: ${params.url}`,
    params.simplify
      ? 'Explícalo con palabras MUY sencillas, frases cortas y tono tranquilo para un adulto mayor.'
      : 'Resume requisitos exactos, costos/fechas si aparecen, pasos numerados claros y canal oficial de atención.',
  ];

  if (params.userQuestion?.trim()) {
    promptParts.push(`Enfócate en responder: "${params.userQuestion.trim()}"`);
  }

  if (params.pageText?.trim()) {
    promptParts.push(
      `Contenido extraído de la página${params.pageTitle ? ` (${params.pageTitle})` : ''}:\n${params.pageText.slice(0, 12000)}`
    );
  } else {
    promptParts.push(
      'Consulta la URL oficial indicada (y búsquedas en el mismo dominio oficial si la página redirige) para construir la guía actualizada.'
    );
  }

  const tools = params.useUrlContextTool
    ? [{ url_context: {} }, { google_search: {} }]
    : undefined;

  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: promptParts.join('\n\n') }],
      },
    ],
    ...(tools ? { tools } : {}),
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: VOICE_GUIDE_JSON_SCHEMA,
      thinkingConfig: {
        thinkingLevel: getThinkingLevelForModel(params.model),
      },
    },
  };
}

export function buildDocumentAnalysisBody(params: {
  image: DocumentImageInput;
  model: string;
  simplify?: boolean;
}) {
  const userQuestion = params.image.prompt?.trim()
    ? `Pregunta adicional de la persona: "${params.image.prompt.trim()}"`
    : 'Explícame qué dice este documento o aviso y qué pasos debo hacer.';

  const instruction = [
    'Analiza la imagen de este documento, receta, volante, convocatoria, comprobante o aviso oficial en México.',
    params.simplify
      ? 'Explícalo con palabras MUY sencillas, frases cortas y tono tranquilo para un adulto mayor.'
      : 'Resume en español claro de qué trata, cuáles son los datos importantes (fechas, horarios, teléfonos, folios o requisitos) y qué debe hacer la persona paso a paso.',
    'Si la imagen no corresponde a un documento o está borrosa, dilo amablemente en simpleAnswer y da consejos para tomar una foto más clara.',
    userQuestion,
  ].join('\n\n');

  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user' as const,
        parts: [
          {
            inlineData: {
              mimeType: params.image.mimeType || 'image/jpeg',
              data: params.image.base64,
            },
          },
          { text: instruction },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: VOICE_GUIDE_JSON_SCHEMA,
      thinkingConfig: {
        thinkingLevel: getThinkingLevelForModel(params.model),
      },
    },
  };
}

export function buildAudioTranscriptionBody(params: {
  base64: string;
  mimeType: string;
  model: string;
}) {
  return {
    contents: [
      {
        role: 'user' as const,
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType || 'audio/mp4',
              data: params.base64,
            },
          },
          {
            text: 'Transcribe exactamente en español de México lo que dijo la persona en este audio sobre un trámite o pregunta. Si solo hay silencio o ruido sin voz humana, devuelve una cadena vacía en transcript.',
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: AUDIO_TRANSCRIPT_SCHEMA,
      thinkingConfig: {
        thinkingLevel: getThinkingLevelForModel(params.model),
      },
    },
  };
}

function extractAnswerText(data: GeminiGenerateContentResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const visiblePart = parts.find(
    (part) => !part.thought && typeof part.text === 'string' && part.text.trim()
  );
  const fallbackPart = parts.find((part) => typeof part.text === 'string' && part.text.trim());
  const raw = visiblePart?.text ?? fallbackPart?.text ?? '';
  if (!raw) return null;
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function normalizeCategory(value?: string): TramiteCategory | undefined {
  if (value === 'salud' || value === 'educacion' || value === 'becas') return value;
  return undefined;
}

export function parseVoiceGuideJson(
  rawText: string,
  options: {
    model: string;
    fallbackTramite?: TramiteRecord | null;
    simplify?: boolean;
    defaultTitle?: string;
    source?: VoiceGuideResponse['source'];
    sourceUrls?: GroundingSource[];
  }
): VoiceGuideResponse {
  const parsed = JSON.parse(rawText) as Partial<VoiceGuideResponse>;
  const fallback = options.fallbackTramite ?? null;

  const normalizedSteps: TramiteStep[] = Array.isArray(parsed.steps)
    ? parsed.steps
        .filter((s) => s && typeof s.title === 'string')
        .map((step, index) => {
          const order = typeof step.order === 'number' && step.order > 0 ? step.order : index + 1;
          const baseInstruction =
            typeof step.instruction === 'string' && step.instruction.trim()
              ? step.instruction.trim()
              : step.simpleExplanation?.trim() ?? '';
          const simpleExplanation =
            typeof step.simpleExplanation === 'string' && step.simpleExplanation.trim()
              ? step.simpleExplanation.trim()
              : baseInstruction;
          return {
            order,
            title: step.title.trim(),
            instruction: options.simplify ? simpleExplanation : baseInstruction,
            simpleExplanation,
          };
        })
    : fallback?.steps ?? [];

  const requirements = Array.isArray(parsed.requirements)
    ? parsed.requirements.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    : fallback?.requirements ?? [];

  const importantDates = Array.isArray(parsed.importantDates)
    ? parsed.importantDates.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : undefined;

  return {
    id: fallback?.id,
    title: parsed.title?.trim() || fallback?.title || options.defaultTitle || 'Guía de trámite',
    category: normalizeCategory(parsed.category) ?? fallback?.category ?? 'educacion',
    institution: parsed.institution?.trim() || fallback?.institution || 'Portal oficial',
    greeting: parsed.greeting?.trim() || 'Con mucho gusto te explico.',
    simpleAnswer: parsed.simpleAnswer?.trim() || fallback?.simpleSummary || '',
    requirements,
    steps: normalizedSteps,
    closingTip: parsed.closingTip?.trim() || 'Recuerda llevar tus documentos en original y copia.',
    documentDetected: parsed.documentDetected?.trim() || undefined,
    importantDates: importantDates && importantDates.length > 0 ? importantDates : undefined,
    sourceUrls: options.sourceUrls && options.sourceUrls.length > 0 ? options.sourceUrls : undefined,
    source: options.source ?? 'gemini',
    modelUsed: options.model,
  };
}

export function buildOfflineGuideResponse(
  query: string,
  tramite: TramiteRecord | null,
  options?: {
    simplify?: boolean;
    source?: 'offline-local' | 'mesh-peer';
    hopCount?: number;
    diagnosticsNote?: string;
  }
): VoiceGuideResponse {
  const source = options?.source ?? 'offline-local';

  if (!tramite) {
    return {
      title: 'No encontré un trámite exacto',
      greeting: 'Te ayudo con gusto.',
      simpleAnswer: `Busqué "${query}" en tu guía local sin internet, pero no encontré coincidencia exacta. Intenta preguntar por: cita médica IMSS, IMSS-Bienestar, beca Benito Juárez, beca Rita Cetina, certificado SEP o constancia de estudios, o importa una página oficial desde el botón Web.`,
      requirements: [],
      steps: [],
      closingTip:
        'También puedes configurar tu API Key de Google Gemini en Ajustes para buscar trámites en vivo en gob.mx o leer documentos con foto.',
      source,
      hopCount: options?.hopCount,
      diagnosticsNote: options?.diagnosticsNote,
    };
  }

  const simplify = options?.simplify ?? false;
  return {
    id: tramite.id,
    title: tramite.title,
    category: tramite.category,
    institution: tramite.institution,
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
    sourceUrls: tramite.sourceUrl
      ? [{ title: tramite.officialChannel || tramite.title, url: tramite.sourceUrl }]
      : undefined,
    source,
    hopCount: options?.hopCount,
    diagnosticsNote: options?.diagnosticsNote,
  };
}

export async function generateVoiceGuide(params: {
  query: string;
  searchResults: SearchResult[];
  apiKey?: string;
  model?: string;
  simplify?: boolean;
  history?: ConversationTurn[];
  enableWebSearch?: boolean;
}): Promise<VoiceGuideResponse> {
  const topMatch = params.searchResults[0]?.tramite ?? null;
  const apiKey = params.apiKey?.trim() ?? '';
  const model = resolveGeminiModel(params.model);
  const offlineSource =
    params.searchResults[0]?.source === 'mesh-hop' ? 'mesh-peer' : 'offline-local';

  if (!apiKey) {
    return buildOfflineGuideResponse(params.query, topMatch, {
      simplify: params.simplify,
      source: offlineSource,
      diagnosticsNote: 'Funcionando en modo offline local (sin API Key de Gemini).',
    });
  }

  // Automatically turn on live Google Search grounding when the local catalog has no strong match
  const shouldSearchWeb =
    params.enableWebSearch ?? (!topMatch || (params.searchResults[0]?.score ?? 0) < 0.22);

  const body = buildGenerateContentBody({
    query: params.query,
    searchResults: params.searchResults,
    model,
    simplify: params.simplify,
    history: params.history,
    enableWebSearch: shouldSearchWeb,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), shouldSearchWeb ? 22000 : 15000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return buildOfflineGuideResponse(params.query, topMatch, {
        simplify: params.simplify,
        source: offlineSource,
        diagnosticsNote: `Gemini devolvió HTTP ${response.status}; se mostró la guía offline.`,
      });
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = extractAnswerText(data);
    if (!rawText) {
      return buildOfflineGuideResponse(params.query, topMatch, {
        simplify: params.simplify,
        source: offlineSource,
        diagnosticsNote: 'Gemini respondió vacío; se mostró la guía offline.',
      });
    }

    const sources = extractGroundingSources(data, topMatch?.sourceUrl);
    return parseVoiceGuideJson(rawText, {
      model,
      fallbackTramite: topMatch,
      simplify: params.simplify,
      source: sources.length > 0 && shouldSearchWeb ? 'gemini-web' : 'gemini',
      sourceUrls: sources,
    });
  } catch {
    return buildOfflineGuideResponse(params.query, topMatch, {
      simplify: params.simplify,
      source: offlineSource,
      diagnosticsNote: 'Sin conexión o tiempo agotado con Gemini; se mostró la guía offline.',
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateGuideFromWebPageWithGemini(params: {
  url: string;
  pageTitle?: string;
  pageText?: string;
  userQuestion?: string;
  apiKey: string;
  model?: string;
  simplify?: boolean;
}): Promise<VoiceGuideResponse | null> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) return null;

  const model = resolveGeminiModel(params.model);
  const useUrlContextTool = !params.pageText?.trim();
  const body = buildWebPageGuideBody({
    url: params.url,
    pageTitle: params.pageTitle,
    pageText: params.pageText,
    userQuestion: params.userQuestion,
    model,
    simplify: params.simplify,
    useUrlContextTool,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = extractAnswerText(data);
    if (!rawText) return null;

    const sources = extractGroundingSources(data, params.url);
    return parseVoiceGuideJson(rawText, {
      model,
      simplify: params.simplify,
      defaultTitle: params.pageTitle || 'Guía desde página oficial',
      source: 'gemini-web',
      sourceUrls: sources,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function transcribeAudioWithGemini(params: {
  base64: string;
  mimeType: string;
  apiKey: string;
  model?: string;
}): Promise<{ ok: boolean; transcript: string; error?: string }> {
  const apiKey = params.apiKey.trim();
  const model = resolveGeminiModel(params.model);
  if (!apiKey) {
    return {
      ok: false,
      transcript: '',
      error: 'Configura tu API Key de Gemini en Ajustes para usar el micrófono en Expo Go.',
    };
  }

  const body = buildAudioTranscriptionBody({
    base64: params.base64,
    mimeType: params.mimeType,
    model,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        transcript: '',
        error: `Gemini devolvió HTTP ${response.status} al transcribir el audio.`,
      };
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = extractAnswerText(data);
    if (!rawText) {
      return { ok: false, transcript: '', error: 'No se detectó voz en la grabación.' };
    }

    const parsed = JSON.parse(rawText) as { transcript?: string };
    const transcript = parsed.transcript?.trim() ?? '';
    if (!transcript) {
      return {
        ok: false,
        transcript: '',
        error: 'No alcancé a escuchar palabras claras. Intenta hablar más cerca del micrófono.',
      };
    }

    return { ok: true, transcript };
  } catch {
    return {
      ok: false,
      transcript: '',
      error: 'Sin conexión a internet para transcribir audio con Gemini.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeDocumentWithGemini(params: {
  image: DocumentImageInput;
  apiKey?: string;
  model?: string;
  simplify?: boolean;
}): Promise<VoiceGuideResponse> {
  const apiKey = params.apiKey?.trim() ?? '';
  const model = resolveGeminiModel(params.model);

  if (!apiKey) {
    return {
      title: 'Lectura de documento requiere Gemini AI',
      greeting: 'Para leer una foto de tu documento necesito activar Gemini.',
      simpleAnswer:
        'Aún no has guardado tu API Key de Google AI Studio. Toca el botón de Ajustes arriba a la derecha para pegarla. Mientras tanto, puedes consultar cualquiera de los trámites oficiales sin internet.',
      requirements: ['Conexión a internet para lectura visual con Gemini', 'API Key gratuita de Google AI Studio'],
      steps: [
        {
          order: 1,
          title: 'Abre Ajustes y Gemini',
          instruction: 'Toca la píldora "Mesh activo" o el icono de engrane en la esquina superior derecha.',
          simpleExplanation: 'Toca el botón de arriba a la derecha para abrir Ajustes.',
        },
        {
          order: 2,
          title: 'Pega tu llave de Google AI Studio',
          instruction: 'Copia tu clave desde aistudio.google.com, pégala en el campo de Gemini y toca "Guardar".',
          simpleExplanation: 'Pega tu clave de Google AI Studio y toca Guardar.',
        },
      ],
      closingTip: 'Las consultas sobre el catálogo local siguen funcionando 100% sin internet.',
      source: 'offline-local',
      diagnosticsNote: 'Falta API Key de Gemini en Ajustes para analizar imágenes.',
    };
  }

  const body = buildDocumentAnalysisBody({
    image: params.image,
    model,
    simplify: params.simplify,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let apiMessage = `HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as GeminiGenerateContentResponse;
        if (errBody.error?.message) {
          apiMessage = `HTTP ${response.status}: ${errBody.error.message}`;
        }
      } catch {
        // Ignore JSON parse error
      }
      return {
        title: 'No pude leer el documento ahora',
        greeting: 'Hubo un problema al conectar con Gemini.',
        simpleAnswer:
          'No logré analizar la imagen en este momento. Verifica tu conexión a internet y que tu API Key de Google AI Studio esté activa en Ajustes.',
        requirements: [],
        steps: [
          {
            order: 1,
            title: 'Verifica tu conexión y clave',
            instruction: 'Abre Ajustes y usa el botón "Probar Gemini" para revisar el estado.',
            simpleExplanation: 'Abre Ajustes y presiona "Probar Gemini".',
          },
        ],
        closingTip: 'También puedes escribir el nombre del trámite para consultarlo sin internet.',
        source: 'offline-local',
        diagnosticsNote: `Error de Gemini (${apiMessage}).`,
      };
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = extractAnswerText(data);
    if (!rawText) {
      return {
        title: 'Imagen recibida sin lectura clara',
        greeting: 'No pude leer el texto de la foto.',
        simpleAnswer:
          'Intenta tomar la fotografía en un lugar bien iluminado, acercando el papel para que las letras se vean nítidas.',
        requirements: [],
        steps: [],
        closingTip: 'Si prefieres, escríbeme de qué trata el papel y te ayudo paso a paso.',
        source: 'offline-local',
        diagnosticsNote: 'Gemini no devolvió texto analizable para esta imagen.',
      };
    }

    return parseVoiceGuideJson(rawText, {
      model,
      simplify: params.simplify,
      defaultTitle: 'Explicación de tu documento',
    });
  } catch {
    return {
      title: 'Sin conexión para leer la foto',
      greeting: 'Parece que ahora no hay internet.',
      simpleAnswer:
        'La lectura de fotos con Gemini necesita internet. Si estás desconectado, puedes elegir una categoría para consultar los trámites guardados en tu teléfono.',
      requirements: [],
      steps: [],
      closingTip: 'Cuando recuperes señal, vuelve a tomar la foto y te la leo en voz alta.',
      source: 'offline-local',
      diagnosticsNote: 'Sin conexión a internet o tiempo de espera agotado (25 s).',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function testGeminiConnection(
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; modelUsed: string; message: string }> {
  const cleanKey = apiKey.trim();
  const resolvedModel = resolveGeminiModel(model);

  if (!cleanKey) {
    return {
      ok: false,
      modelUsed: resolvedModel,
      message: 'Primero pega tu API Key de Google AI Studio.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      resolvedModel
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responde solamente: OK' }] }],
        generationConfig: {
          maxOutputTokens: 16,
          thinkingConfig: {
            thinkingLevel: getThinkingLevelForModel(resolvedModel),
          },
        },
      }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = (await response.json()) as GeminiGenerateContentResponse;
        if (err.error?.message) {
          detail = `${detail} — ${err.error.message}`;
        }
      } catch {
        // Ignore parse error
      }
      return {
        ok: false,
        modelUsed: resolvedModel,
        message: `No se pudo conectar (${detail}).`,
      };
    }

    return {
      ok: true,
      modelUsed: resolvedModel,
      message: `Conexión exitosa con ${resolvedModel}. Voz, búsqueda web y lectura de fotos están listas.`,
    };
  } catch {
    return {
      ok: false,
      modelUsed: resolvedModel,
      message: 'No hay acceso a generativelanguage.googleapis.com desde esta red.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

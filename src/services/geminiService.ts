import {
  ConversationTurn,
  DocumentImageInput,
  SearchResult,
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
    description: 'Más rápido y económico (recomendado para voz y lectura de documentos)',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: 'Equilibrio entre velocidad y razonamiento multimodal',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    description: 'Máxima precisión en trámites complejos y documentos densos',
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

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
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
  'Tu objetivo es explicar trámites de salud, educación y becas, o leer y explicar documentos oficiales fotografiados, en español de México claro y fácil de escuchar en voz alta.',
  'Usa frases cortas, evita siglas sin explicar y nunca inventes datos oficiales, fechas o montos que no aparezcan en el contexto o en el documento.',
  'Si una parte de un documento es borrosa o ilegible, dilo con honestidad y sugiere verificar en la ventanilla oficial.',
].join(' ');

export const VOICE_GUIDE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Título corto y claro del trámite o documento',
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
      description: 'Fechas límite, horarios, folios o teléfonos clave encontrados',
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
      description: 'Pasos ordenados que la persona debe seguir',
    },
    closingTip: {
      type: 'string',
      description: 'Consejo práctico final o recomendación de canal oficial',
    },
  },
  required: ['title', 'greeting', 'simpleAnswer', 'requirements', 'steps', 'closingTip'],
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

function sanitizeHistory(history?: ConversationTurn[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  if (!history || history.length === 0) return [];
  const recent = history.slice(-6).filter((turn) => turn.text.trim().length > 0);
  // Ensure the history starts with a user turn and merges consecutive same-role turns
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

export function buildGenerateContentBody(params: {
  query: string;
  searchResults: SearchResult[];
  model: string;
  simplify?: boolean;
  history?: ConversationTurn[];
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
      : 'No hubo coincidencia exacta en el catálogo local; ofrece orientación general segura para México y recomienda verificar en ventanilla oficial.',
  ].join('\n\n');

  const historyContents = sanitizeHistory(params.history);
  // Guarantee the request always ends with a user turn (Gemini 3.6+ rejects trailing model turns)
  const contents = [
    ...historyContents,
    { role: 'user' as const, parts: [{ text: userPrompt }] },
  ];

  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
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

function extractAnswerText(data: GeminiGenerateContentResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const visiblePart = parts.find((part) => !part.thought && typeof part.text === 'string' && part.text.trim());
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

export function parseVoiceGuideJson(
  rawText: string,
  options: {
    model: string;
    fallbackTramite?: TramiteRecord | null;
    simplify?: boolean;
    defaultTitle?: string;
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
    title: parsed.title?.trim() || fallback?.title || options.defaultTitle || 'Guía de trámite',
    greeting: parsed.greeting?.trim() || 'Con mucho gusto te explico.',
    simpleAnswer: parsed.simpleAnswer?.trim() || fallback?.simpleSummary || '',
    requirements,
    steps: normalizedSteps,
    closingTip: parsed.closingTip?.trim() || 'Recuerda llevar tus documentos en original y copia.',
    documentDetected: parsed.documentDetected?.trim() || undefined,
    importantDates: importantDates && importantDates.length > 0 ? importantDates : undefined,
    source: 'gemini',
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
      simpleAnswer: `Busqué "${query}" en tu guía local sin internet, pero no encontré coincidencia exacta. Intenta preguntar por: cita médica IMSS, IMSS-Bienestar, beca Benito Juárez, beca Rita Cetina, certificado SEP o constancia de estudios.`,
      requirements: [],
      steps: [],
      closingTip:
        'También puedes configurar tu API Key de Google Gemini en Ajustes para consultas abiertas o lectura de documentos con foto.',
      source,
      hopCount: options?.hopCount,
      diagnosticsNote: options?.diagnosticsNote,
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
}): Promise<VoiceGuideResponse> {
  const topMatch = params.searchResults[0]?.tramite ?? null;
  const apiKey = params.apiKey?.trim() ?? '';
  const model = resolveGeminiModel(params.model);
  const offlineSource = params.searchResults[0]?.source === 'mesh-hop' ? 'mesh-peer' : 'offline-local';

  if (!apiKey) {
    return buildOfflineGuideResponse(params.query, topMatch, {
      simplify: params.simplify,
      source: offlineSource,
      diagnosticsNote: 'Funcionando en modo offline local (sin API Key de Gemini).',
    });
  }

  const body = buildGenerateContentBody({
    query: params.query,
    searchResults: params.searchResults,
    model,
    simplify: params.simplify,
    history: params.history,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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

    return parseVoiceGuideJson(rawText, {
      model,
      fallbackTramite: topMatch,
      simplify: params.simplify,
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
        'Aún no has guardado tu API Key de Google AI Studio. Toca el botón de Ajustes arriba a la derecha (icono de persona o píldora Mesh) para pegarla. Mientras tanto, puedes consultar cualquiera de los trámites oficiales sin internet.',
      requirements: ['Conexión a internet para lectura visual con Gemini', 'API Key gratuita de Google AI Studio'],
      steps: [
        {
          order: 1,
          title: 'Abre Ajustes y Gemini',
          instruction: 'Toca la píldora "Mesh activo" o el icono de usuario en la esquina superior derecha.',
          simpleExplanation: 'Toca el botón de arriba a la derecha para abrir Ajustes.',
        },
        {
          order: 2,
          title: 'Pega tu llave de Google AI Studio',
          instruction: 'Copia tu clave desde aistudio.google.com, pégala en el campo de Gemini y toca "Guardar configuración".',
          simpleExplanation: 'Pega tu clave de Google AI Studio y toca Guardar.',
        },
      ],
      closingTip: 'Las consultas por texto y voz sobre trámites del catálogo siguen funcionando 100% sin internet.',
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
        // Ignore JSON parse error on error response
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
            instruction: 'Abre Ajustes y usa el botón "Probar conexión con Gemini" para revisar el estado.',
            simpleExplanation: 'Abre Ajustes y presiona "Probar conexión con Gemini".',
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
        'La lectura de fotos con Gemini necesita internet. Si estás desconectado, puedes escribir o elegir una categoría para consultar los trámites guardados en tu teléfono.',
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
      message: `Conexión exitosa con ${resolvedModel}. Gemini AI y lectura de documentos están listos.`,
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

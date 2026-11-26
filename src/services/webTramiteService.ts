import {
  TramiteCategory,
  TramiteRecord,
  TramiteStep,
  VoiceGuideResponse,
} from '../types/vozGuia';
import { generateGuideFromWebPageWithGemini } from './geminiService';

export interface OfficialPortalShortcut {
  id: string;
  label: string;
  institution: string;
  category: TramiteCategory;
  url: string;
  description: string;
}

export const OFFICIAL_TRAMITE_SOURCES: OfficialPortalShortcut[] = [
  {
    id: 'imss-cita-web',
    label: 'Cita Médica IMSS',
    institution: 'IMSS',
    category: 'salud',
    url: 'https://www.imss.gob.mx/cita-medica',
    description: 'Portal oficial para agendar cita con médico familiar.',
  },
  {
    id: 'imss-bienestar-web',
    label: 'IMSS-Bienestar',
    institution: 'IMSS-Bienestar',
    category: 'salud',
    url: 'https://registro.imssbienestar.gob.mx/',
    description: 'Registro gratuito para personas sin seguridad social.',
  },
  {
    id: 'becas-bj-web',
    label: 'Becas Benito Juárez',
    institution: 'CNBBBJ',
    category: 'becas',
    url: 'https://www.gob.mx/becasbenitojuarez',
    description: 'Convocatorias, requisitos y calendario de pagos.',
  },
  {
    id: 'beca-rita-web',
    label: 'Beca Rita Cetina',
    institution: 'SEP / CNBBBJ',
    category: 'becas',
    url: 'https://www.becaritacetina.gob.mx/',
    description: 'Beca universal para educación básica.',
  },
  {
    id: 'gob-acta-web',
    label: 'Acta de Nacimiento',
    institution: 'Gobierno de México',
    category: 'educacion',
    url: 'https://www.gob.mx/ActaNacimiento/',
    description: 'Consulta y descarga de copia certificada en línea.',
  },
  {
    id: 'gob-bienestar-web',
    label: 'Pensión Bienestar',
    institution: 'Secretaría de Bienestar',
    category: 'salud',
    url: 'https://www.gob.mx/bienestar',
    description: 'Apoyos y pensión para personas adultas mayores.',
  },
  {
    id: 'gob-sep-web',
    label: 'SEP Trámites',
    institution: 'SEP',
    category: 'educacion',
    url: 'https://www.gob.mx/sep',
    description: 'Certificados, constancias y becas educativas.',
  },
];

export interface ExtractedWebPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  bullets: string[];
  paragraphs: string[];
  phones: string[];
  plainText: string;
}

const HTML_ENTITIES: Record<string, string> = {
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&uuml;': 'ü',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Ntilde;': 'Ñ',
  '&iquest;': '¿',
  '&iexcl;': '¡',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
      if (HTML_ENTITIES[entity]) return HTML_ENTITIES[entity];
      const numMatch = /^&#(\d+);$/.exec(entity);
      if (numMatch) {
        const code = Number(numMatch[1]);
        return Number.isFinite(code) ? String.fromCharCode(code) : ' ';
      }
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(htmlChunk: string): string {
  return decodeEntities(htmlChunk.replace(/<[^>]+>/g, ' '));
}

export function normalizeOfficialUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function inferCategoryFromText(text: string): TramiteCategory {
  const lower = text.toLowerCase();
  if (/(beca|apoyo econ|benito ju|rita cetina|manutenci)/.test(lower)) return 'becas';
  if (/(imss|issste|salud|m[eé]dic|cl[ií]nica|vacuna|hospital|bienestar|pensi[oó]n)/.test(lower)) {
    return 'salud';
  }
  return 'educacion';
}

export function extractReadablePageFromHtml(html: string, sourceUrl: string): ExtractedWebPage {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
  const metaDescMatch =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(cleaned) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i.exec(cleaned);

  const headings: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null = headingRegex.exec(cleaned);
  while (match && headings.length < 12) {
    const text = stripTags(match[1]);
    if (text.length >= 4 && text.length <= 140) headings.push(text);
    match = headingRegex.exec(cleaned);
  }

  const bullets: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  match = liRegex.exec(cleaned);
  while (match && bullets.length < 24) {
    const text = stripTags(match[1]);
    if (text.length >= 12 && text.length <= 220 && !/^(inicio|contacto|aviso|privacidad|menu)/i.test(text)) {
      bullets.push(text);
    }
    match = liRegex.exec(cleaned);
  }

  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  match = pRegex.exec(cleaned);
  while (match && paragraphs.length < 16) {
    const text = stripTags(match[1]);
    if (text.length >= 25 && text.length <= 420) {
      paragraphs.push(text);
    }
    match = pRegex.exec(cleaned);
  }

  const plainText = stripTags(cleaned).slice(0, 12000);
  const phones = Array.from(
    new Set(
      (plainText.match(/(?:800|55|33|81)[\s-]?\d{3,4}[\s-]?\d{4}/g) ?? []).map((p) => p.trim())
    )
  ).slice(0, 3);

  const title =
    (titleMatch ? stripTags(titleMatch[1]) : '') ||
    headings[0] ||
    sourceUrl.replace(/^https?:\/\//i, '');
  const description = metaDescMatch ? decodeEntities(metaDescMatch[1]) : paragraphs[0] ?? '';

  return {
    url: sourceUrl,
    title,
    description,
    headings,
    bullets,
    paragraphs,
    phones,
    plainText,
  };
}

export function parseHtmlToFunctionalGuide(
  html: string,
  sourceUrl: string,
  options?: { simplify?: boolean }
): VoiceGuideResponse {
  const extracted = extractReadablePageFromHtml(html, sourceUrl);
  const category = inferCategoryFromText(`${extracted.title} ${extracted.description} ${sourceUrl}`);

  const requirementCandidates = extracted.bullets.filter((b) =>
    /(curp|ine|identificaci|acta|comprobante|nss|correo|tel[eé]fono|cartilla|boleta|constancia|documento|requisito|original|copia)/i.test(
      b
    )
  );
  const requirements = (
    requirementCandidates.length > 0 ? requirementCandidates : extracted.bullets.slice(0, 4)
  ).slice(0, 6);

  const stepCandidates = extracted.bullets
    .filter((b) => !requirements.includes(b))
    .slice(0, 4);

  const steps: TramiteStep[] = [];
  if (stepCandidates.length > 0) {
    stepCandidates.forEach((item, idx) => {
      steps.push({
        order: idx + 1,
        title: `Paso ${idx + 1} del portal oficial`,
        instruction: item,
        simpleExplanation: item,
      });
    });
  } else {
    extracted.headings.slice(0, 3).forEach((heading, idx) => {
      const detail = extracted.paragraphs[idx] || `Revisa la sección "${heading}" en el portal oficial.`;
      steps.push({
        order: idx + 1,
        title: heading,
        instruction: detail,
        simpleExplanation: detail,
      });
    });
  }

  if (steps.length === 0) {
    steps.push({
      order: 1,
      title: 'Abrir el portal oficial y reunir requisitos',
      instruction: `Ingresa a ${sourceUrl} y sigue las indicaciones publicadas en la página oficial.`,
      simpleExplanation: `Abre ${sourceUrl} para ver los requisitos y fechas actualizadas.`,
    });
  }

  const host = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return sourceUrl;
    }
  })();

  const simpleSummary =
    extracted.description ||
    extracted.paragraphs[0] ||
    `Información obtenida directamente de ${host}.`;

  return {
    id: `web-${host.replace(/[^a-z0-9]/gi, '-')}-${Math.abs(
      Array.from(sourceUrl).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
    )}`,
    title: extracted.title,
    category,
    institution: host,
    greeting: `Extraje esta guía directamente desde ${host}.`,
    simpleAnswer: options?.simplify ? simpleSummary.slice(0, 220) : simpleSummary,
    requirements,
    steps,
    importantDates:
      extracted.phones.length > 0
        ? extracted.phones.map((phone) => `Teléfono oficial encontrado: ${phone}`)
        : undefined,
    closingTip: `Fuente oficial directa: ${sourceUrl}. Esta guía ya quedó guardada en tu teléfono para consultarla sin internet.`,
    sourceUrls: [{ title: extracted.title, url: sourceUrl }],
    source: 'web-page',
  };
}

export function guideResponseToTramiteRecord(
  guide: VoiceGuideResponse,
  sourceUrl?: string
): TramiteRecord {
  const primaryUrl = sourceUrl || guide.sourceUrls?.[0]?.url;
  const slugBase = guide.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return {
    id: guide.id || `web-${slugBase || Date.now()}`,
    title: guide.title,
    category: guide.category ?? inferCategoryFromText(`${guide.title} ${guide.simpleAnswer}`),
    institution: guide.institution || 'Portal oficial',
    summary: guide.simpleAnswer,
    simpleSummary: guide.simpleAnswer,
    requirements: guide.requirements,
    steps: guide.steps,
    cost: 'Consultar en portal oficial',
    estimatedTime: 'Variable según trámite',
    officialChannel: primaryUrl || guide.institution || 'Portal oficial',
    keywords: guide.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3),
    updatedAt: new Date().toISOString().slice(0, 10),
    sourceUrl: primaryUrl,
  };
}

export async function fetchOfficialTramiteGuide(params: {
  url: string;
  userQuestion?: string;
  apiKey?: string;
  model?: string;
  simplify?: boolean;
}): Promise<{ guide: VoiceGuideResponse; tramiteRecord: TramiteRecord | null }> {
  const normalizedUrl = normalizeOfficialUrl(params.url);
  if (!normalizedUrl) {
    return {
      tramiteRecord: null,
      guide: {
        title: 'Dirección web no válida',
        greeting: 'Revisa el enlace que escribiste.',
        simpleAnswer:
          'Por favor ingresa una dirección web válida (por ejemplo: https://www.gob.mx/tramites o elige uno de los portales oficiales sugeridos).',
        requirements: [],
        steps: [],
        closingTip: 'Puedes tocar cualquiera de los botones de portales oficiales de México.',
        source: 'offline-local',
      },
    };
  }

  let fetchedHtml: string | null = null;
  let fetchErrorDetail = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      fetchedHtml = await res.text();
    } else {
      fetchErrorDetail = `HTTP ${res.status}`;
    }
  } catch {
    fetchErrorDetail = 'bloqueo CORS del navegador o sin conexión directa';
  }

  const extracted = fetchedHtml ? extractReadablePageFromHtml(fetchedHtml, normalizedUrl) : null;
  const apiKey = params.apiKey?.trim() ?? '';

  // 1. Prefer Gemini turning the real page content (or URL Context tool if browser CORS blocked direct fetch) into an empathetic guide
  if (apiKey) {
    const geminiGuide = await generateGuideFromWebPageWithGemini({
      url: normalizedUrl,
      pageTitle: extracted?.title,
      pageText: extracted?.plainText,
      userQuestion: params.userQuestion,
      apiKey,
      model: params.model,
      simplify: params.simplify,
    });

    if (geminiGuide) {
      const record = guideResponseToTramiteRecord(geminiGuide, normalizedUrl);
      const guideWithId: VoiceGuideResponse = { ...geminiGuide, id: record.id };
      return { guide: guideWithId, tramiteRecord: record };
    }
  }

  // 2. Even without Gemini API Key, parse the real fetched webpage into a working interactive guide
  if (fetchedHtml) {
    const parsedGuide = parseHtmlToFunctionalGuide(fetchedHtml, normalizedUrl, {
      simplify: params.simplify,
    });
    const record = guideResponseToTramiteRecord(parsedGuide, normalizedUrl);
    return {
      guide: {
        ...parsedGuide,
        id: record.id,
        diagnosticsNote: apiKey
          ? 'Se extrajo directamente de la página oficial (sin pasar por Gemini).'
          : 'Extraído directamente de la página oficial (sin usar API Key).',
      },
      tramiteRecord: record,
    };
  }

  // 3. Honest fallback when both direct fetch (e.g. Web CORS) and Gemini key are unavailable
  return {
    tramiteRecord: null,
    guide: {
      title: 'No se pudo descargar la página directamente',
      greeting: 'El navegador bloqueó la lectura directa de este sitio.',
      simpleAnswer: `No pude descargar ${normalizedUrl} directamente (${fetchErrorDetail}). En el celular con Expo Go o APK suele funcionar directo; en navegador Web agrega tu API Key de Gemini en Ajustes para que Gemini lea la URL oficial sin restricciones CORS.`,
      requirements: [],
      steps: [
        {
          order: 1,
          title: 'Opción A: Abrir desde el celular (Expo Go / APK)',
          instruction: 'En Android/iOS la app puede leer páginas oficiales directamente sin bloqueo CORS.',
          simpleExplanation: 'Prueba este mismo enlace desde la app en tu celular.',
        },
        {
          order: 2,
          title: 'Opción B: Activar Gemini en Ajustes',
          instruction: 'Pega tu API Key gratuita de Google AI Studio en Ajustes para leer cualquier página de gob.mx desde Web o móvil.',
          simpleExplanation: 'Guarda tu clave de Gemini en Ajustes y vuelve a intentarlo.',
        },
      ],
      closingTip: `También puedes abrir el sitio directamente aquí: ${normalizedUrl}`,
      sourceUrls: [{ title: 'Abrir portal oficial', url: normalizedUrl }],
      source: 'offline-local',
      diagnosticsNote: `Descarga directa no disponible (${fetchErrorDetail}).`,
    },
  };
}

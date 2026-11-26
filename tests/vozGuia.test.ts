import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAMITES_CATALOG } from '../src/data/tramitesCatalog';
import {
  analyzeDocumentWithGemini,
  buildAudioTranscriptionBody,
  buildDocumentAnalysisBody,
  buildGenerateContentBody,
  buildOfflineGuideResponse,
  buildWebPageGuideBody,
  DEFAULT_GEMINI_MODEL,
  extractBase64FromPickerAsset,
  parseVoiceGuideJson,
  resolveGeminiModel,
} from '../src/services/geminiService';
import { ControlledFloodingRouter } from '../src/services/meshRouter';
import { createVectorIndex, searchVectorIndex } from '../src/services/vectorSearch';
import {
  extractReadablePageFromHtml,
  guideResponseToTramiteRecord,
  normalizeOfficialUrl,
  parseHtmlToFunctionalGuide,
} from '../src/services/webTramiteService';

test('vectorSearch finds medical appointment tramite offline', () => {
  const index = createVectorIndex(TRAMITES_CATALOG);
  const results = searchVectorIndex(index, 'necesito sacar una cita con el doctor en el imss');
  assert.ok(results.length > 0);
  assert.equal(results[0].tramite.id, 'salud-cita-imss');
  assert.ok(results[0].score > 0.1);
});

test('vectorSearch finds scholarship tramite with category filter', () => {
  const index = createVectorIndex(TRAMITES_CATALOG);
  const results = searchVectorIndex(index, 'quiero pedir una beca de preparatoria', {
    category: 'becas',
  });
  assert.ok(results.length > 0);
  assert.equal(results[0].tramite.id, 'becas-benito-juarez');
});

test('ControlledFloodingRouter deduplicates packets and enforces TTL', () => {
  const origin = new ControlledFloodingRouter({ nodeId: 'NODE-1', defaultMaxHops: 2 });
  const hop1 = new ControlledFloodingRouter({ nodeId: 'NODE-2', defaultMaxHops: 2 });
  const hop2 = new ControlledFloodingRouter({ nodeId: 'NODE-3', defaultMaxHops: 2 });

  const packet = origin.createPacket('QUERY', { query: 'beca' });
  assert.equal(packet.ttl, 2);

  const d1 = hop1.receivePacket(packet);
  assert.equal(d1.action, 'DELIVER_LOCAL_AND_RELAY');
  if (d1.action !== 'DELIVER_LOCAL_AND_RELAY') return;
  assert.equal(d1.forwardPacket.ttl, 1);
  assert.equal(d1.forwardPacket.hopCount, 1);

  const dup = hop1.receivePacket(packet);
  assert.equal(dup.action, 'DROP_DUPLICATE');

  const d2 = hop2.receivePacket(d1.forwardPacket);
  assert.equal(d2.action, 'DELIVER_LOCAL_ONLY');
});

test('buildOfflineGuideResponse simplifies instructions when requested', () => {
  const cita = TRAMITES_CATALOG.find((t) => t.id === 'salud-cita-imss') ?? null;
  const simplified = buildOfflineGuideResponse('cita medica', cita, { simplify: true });
  assert.equal(simplified.source, 'offline-local');
  assert.ok(simplified.steps.length > 0);
  assert.equal(simplified.steps[0].instruction, cita?.steps[0].simpleExplanation);
});

test('resolveGeminiModel migrates deprecated models to current Gemini 3.x IDs', () => {
  assert.equal(resolveGeminiModel(undefined), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel('gemini-2.5-flash'), 'gemini-3.5-flash-lite');
  assert.equal(resolveGeminiModel('gemini-2.5-pro'), 'gemini-3.8-flash');
  assert.equal(resolveGeminiModel('gemini-3.8-flash'), 'gemini-3.8-flash');
});

test('buildGenerateContentBody uses JSON schema, valid thinkingLevel, and multi-turn history', () => {
  const index = createVectorIndex(TRAMITES_CATALOG);
  const results = searchVectorIndex(index, 'cita imss');

  const liteBody = buildGenerateContentBody({
    query: '¿Y si no tengo correo?',
    searchResults: results,
    model: 'gemini-3.5-flash-lite',
    history: [
      { role: 'user', text: 'Cómo sacar cita médica IMSS' },
      { role: 'model', text: 'Necesitas tu CURP y NSS.' },
    ],
  });

  assert.equal(liteBody.generationConfig.responseMimeType, 'application/json');
  assert.ok(liteBody.generationConfig.responseJsonSchema);
  assert.equal(liteBody.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
  assert.equal('temperature' in liteBody.generationConfig, false);
  assert.equal(liteBody.contents[liteBody.contents.length - 1].role, 'user');
  assert.equal(liteBody.contents.length, 3);

  const webBody = buildGenerateContentBody({
    query: 'Cómo tramitar pasaporte mexicano',
    searchResults: [],
    model: 'gemini-3.8-flash',
    enableWebSearch: true,
  });
  assert.equal(webBody.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.ok('tools' in webBody);
});

test('buildDocumentAnalysisBody encodes multimodal image payload and parses structured output', () => {
  const extracted = extractBase64FromPickerAsset({
    uri: 'data:image/png;base64,iVBORw0KGgo=',
  });
  assert.ok(extracted);
  assert.equal(extracted.base64, 'iVBORw0KGgo=');
  assert.equal(extracted.mimeType, 'image/png');

  const body = buildDocumentAnalysisBody({
    image: { base64: 'iVBORw0KGgo=', mimeType: 'image/png' },
    model: 'gemini-3.5-flash-lite',
    simplify: true,
  });

  const firstPart = body.contents[0].parts[0] as { inlineData?: { mimeType: string; data: string } };
  assert.equal(firstPart.inlineData?.mimeType, 'image/png');
  assert.equal(firstPart.inlineData?.data, 'iVBORw0KGgo=');

  const parsed = parseVoiceGuideJson(
    JSON.stringify({
      title: 'Cita de Medicina Familiar',
      greeting: 'Con gusto te leo tu hoja.',
      simpleAnswer: 'Tu cita es el 10 de diciembre a las 9 de la mañana.',
      documentDetected: 'Comprobante de cita IMSS',
      importantDates: ['10 de diciembre, 09:00 hrs', 'Consultorio 4'],
      requirements: ['Cartilla Nacional de Salud', 'INE'],
      steps: [
        {
          order: 1,
          title: 'Llegar temprano',
          instruction: 'Preséntate 15 minutos antes en el consultorio 4.',
          simpleExplanation: 'Llega un poquito antes de las 9 con tu cartilla.',
        },
      ],
      closingTip: 'Lleva tu receta anterior si tomas medicamento.',
    }),
    { model: 'gemini-3.5-flash-lite', simplify: true }
  );

  assert.equal(parsed.source, 'gemini');
  assert.equal(parsed.documentDetected, 'Comprobante de cita IMSS');
  assert.equal(parsed.importantDates?.length, 2);
  assert.equal(parsed.importantDates?.[0], '10 de diciembre, 09:00 hrs');
  assert.equal(parsed.steps[0].instruction, 'Llega un poquito antes de las 9 con tu cartilla.');
});

test('analyzeDocumentWithGemini gracefully falls back when no API key is configured', async () => {
  const response = await analyzeDocumentWithGemini({
    image: { base64: 'AAAA', mimeType: 'image/jpeg' },
    apiKey: '',
  });
  assert.equal(response.source, 'offline-local');
  assert.ok(response.steps.length > 0);
  assert.ok(response.diagnosticsNote?.includes('API Key'));
});

test('buildAudioTranscriptionBody creates structured multimodal audio request', () => {
  const body = buildAudioTranscriptionBody({
    base64: 'UklGRg==',
    mimeType: 'audio/mp4',
    model: 'gemini-3.5-flash-lite',
  });
  const firstPart = body.contents[0].parts[0] as { inlineData?: { mimeType: string; data: string } };
  assert.equal(firstPart.inlineData?.mimeType, 'audio/mp4');
  assert.equal(firstPart.inlineData?.data, 'UklGRg==');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
});

test('webTramiteService parses official HTML page into functional offline guide and TramiteRecord', () => {
  assert.equal(normalizeOfficialUrl('gob.mx/tramites'), 'https://gob.mx/tramites');

  const sampleHtml = `
    <html>
      <head>
        <title>Pensi&oacute;n para el Bienestar | gob.mx</title>
        <meta name="description" content="Apoyo bimestral gratuito para personas adultas mayores de 65 a&ntilde;os en M&eacute;xico." />
      </head>
      <body>
        <h1>Pensi&oacute;n para el Bienestar</h1>
        <p>Para realizar tu registro acude al m&oacute;dulo m&aacute;s cercano o llama al 800 639 4264.</p>
        <ul>
          <li>Identificaci&oacute;n oficial vigente (INE o INAPAM) en original y copia</li>
          <li>CURP de impresi&oacute;n reciente y comprobante de domicilio</li>
          <li>Ubica tu m&oacute;dulo de Bienestar seg&uacute;n la letra de tu primer apellido</li>
          <li>Entrega tus papeles y guarda tu tal&oacute;n de registro para recoger tu tarjeta</li>
        </ul>
      </body>
    </html>
  `;

  const extracted = extractReadablePageFromHtml(sampleHtml, 'https://www.gob.mx/bienestar');
  assert.equal(extracted.title, 'Pensión para el Bienestar | gob.mx');
  assert.ok(extracted.phones.includes('800 639 4264'));

  const guide = parseHtmlToFunctionalGuide(sampleHtml, 'https://www.gob.mx/bienestar');
  assert.equal(guide.source, 'web-page');
  assert.equal(guide.category, 'salud');
  assert.ok(guide.requirements.length >= 2);
  assert.ok(guide.steps.length >= 2);
  assert.equal(guide.sourceUrls?.[0]?.url, 'https://www.gob.mx/bienestar');

  const record = guideResponseToTramiteRecord(guide, 'https://www.gob.mx/bienestar');
  assert.equal(record.sourceUrl, 'https://www.gob.mx/bienestar');
  assert.ok(record.steps.length >= 2);

  const urlContextBody = buildWebPageGuideBody({
    url: 'https://www.gob.mx/bienestar',
    model: 'gemini-3.5-flash-lite',
    useUrlContextTool: true,
  });
  assert.ok('tools' in urlContextBody);
});

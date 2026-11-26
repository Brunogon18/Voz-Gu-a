import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAMITES_CATALOG } from '../src/data/tramitesCatalog';
import { buildOfflineGuideResponse } from '../src/services/geminiService';
import { ControlledFloodingRouter } from '../src/services/meshRouter';
import { createVectorIndex, searchVectorIndex } from '../src/services/vectorSearch';

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

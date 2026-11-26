#!/usr/bin/env node
/**
 * Servidor Relay Mesh local (cero dependencias) para pruebas multi-dispositivo en Expo Go y Web.
 * Permite que 2+ teléfonos en la misma red Wi-Fi intercambien paquetes reales de Voz Guía
 * (BEACON, QUERY, RESPONSE, TRAMITE_SHARE) usando el protocolo ControlledFloodingRouter.
 *
 * Uso: npm run mesh:relay
 */
import http from 'node:http';
import os from 'node:os';

const PORT = Number(process.env.MESH_RELAY_PORT || 8787);
const MAX_BUFFER = 250;
const PACKET_TTL_MS = 5 * 60 * 1000;

let seq = 0;
/** @type {{ seq: number; receivedAt: number; packet: Record<string, unknown> }[]} */
const ringBuffer = [];

function pruneExpired() {
  const cutoff = Date.now() - PACKET_TTL_MS;
  while (ringBuffer.length > 0 && ringBuffer[0].receivedAt < cutoff) {
    ringBuffer.shift();
  }
  if (ringBuffer.length > MAX_BUFFER) {
    ringBuffer.splice(0, ringBuffer.length - MAX_BUFFER);
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://127.0.0.1:${PORT}`);
  pruneExpired();

  if (req.method === 'GET' && parsed.pathname === '/mesh/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'voz-guia-mesh-relay',
      bufferedPackets: ringBuffer.length,
      latestSeq: seq,
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/mesh/poll') {
    const since = Number(parsed.searchParams.get('since') || 0);
    const nodeId = parsed.searchParams.get('nodeId') || '';
    const packets = ringBuffer
      .filter((entry) => entry.seq > since && entry.packet.senderId !== nodeId)
      .map((entry) => entry.packet);

    sendJson(res, 200, {
      ok: true,
      latestSeq: seq,
      packets,
    });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/mesh/send') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 256 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const packet = JSON.parse(rawBody);
        if (!packet || typeof packet !== 'object' || !packet.packetId) {
          sendJson(res, 400, { ok: false, error: 'Invalid mesh packet' });
          return;
        }
        seq += 1;
        ringBuffer.push({ seq, receivedAt: Date.now(), packet });
        pruneExpired();
        sendJson(res, 200, { ok: true, seq });
      } catch {
        sendJson(res, 400, { ok: false, error: 'Malformed JSON' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  console.log(`\n🌐 Voz Guía Mesh Relay escuchando en puerto ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  for (const addr of addresses) {
    console.log(`   Wi-Fi (para celulares Expo Go): http://${addr}:${PORT}`);
  }
  console.log('   Pega esa URL en Ajustes -> Red Mesh -> URL de Relay Mesh Local.\n');
});

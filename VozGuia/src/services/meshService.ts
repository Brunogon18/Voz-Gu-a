import {
  broadcastNativePacket,
  meshEmitter,
  startNativeMesh,
  stopNativeMesh,
} from '../native/androidBridge';
import { MeshPacket, MeshPeer, MeshStats, SearchResult } from '../types/vozGuia';
import { saveMeshCachedResponse, searchTramitesLocal } from './database';
import { kvStore } from './kvStore';
import { ControlledFloodingRouter } from './meshRouter';

const INITIAL_DEMO_PEERS: MeshPeer[] = [
  {
    peerId: 'VG-NODO-A1',
    displayName: 'Teléfono Comunitario (Salto 1)',
    rssi: -58,
    hasInternet: false,
    lastSeenAt: Date.now(),
    hopDistance: 1,
  },
  {
    peerId: 'VG-NODO-B2',
    displayName: 'Punto Educativo Coyoacán (Salto 2)',
    rssi: -71,
    hasInternet: true,
    lastSeenAt: Date.now(),
    hopDistance: 2,
  },
];

class MeshServiceManager {
  private router: ControlledFloodingRouter;
  private initialized = false;
  private eventLog: string[] = [];

  constructor() {
    const nodeId = kvStore.getOrCreateNodeId();
    const settings = kvStore.getSettings();
    this.router = new ControlledFloodingRouter({
      nodeId,
      defaultMaxHops: settings.maxHops,
    });
    for (const peer of INITIAL_DEMO_PEERS) {
      this.router.upsertPeer(peer);
    }
  }

  async start(): Promise<MeshStats> {
    const settings = kvStore.getSettings();
    if (!this.initialized && meshEmitter) {
      meshEmitter.addListener('onMeshPacketReceived', (...args: unknown[]) => {
        const rawJson = typeof args[0] === 'string' ? args[0] : '';
        if (rawJson) {
          void this.handleIncomingRawPacket(rawJson);
        }
      });
      meshEmitter.addListener('onMeshPeerDiscovered', (...args: unknown[]) => {
        const peer = args[0] as MeshPeer | undefined;
        if (peer?.peerId) {
          this.router.upsertPeer(peer);
          this.pushLog(`Dispositivo cercano detectado: ${peer.displayName}`);
        }
      });
      this.initialized = true;
    }

    const nativeStarted = await startNativeMesh(this.router.getNodeId(), settings.maxHops);
    this.router.setRunning(true, true);
    this.pushLog(
      nativeStarted
        ? `Red BLE Mesh activa en primer plano (Nodo ${this.router.getNodeId()})`
        : `Red Mesh activa en modo híbrido/simulador (Nodo ${this.router.getNodeId()})`
    );
    return this.router.getStats();
  }

  async stop(): Promise<MeshStats> {
    await stopNativeMesh();
    this.router.setRunning(false, false);
    this.pushLog('Red BLE Mesh pausada (solo opera con la app en primer plano)');
    return this.router.getStats();
  }

  setForegroundActive(active: boolean): void {
    const stats = this.router.getStats();
    this.router.setRunning(active && stats.isRunning, active);
  }

  getStats(): MeshStats {
    return this.router.getStats();
  }

  getPeers(): MeshPeer[] {
    return this.router.getPeers();
  }

  getEventLog(): string[] {
    return [...this.eventLog];
  }

  async handleIncomingRawPacket(rawJson: string): Promise<void> {
    try {
      const packet = JSON.parse(rawJson) as MeshPacket;
      const decision = this.router.receivePacket(packet);

      if (decision.action === 'DROP_DUPLICATE') {
        this.pushLog(`Paquete duplicado descartado (${packet.packetId})`);
        return;
      }
      if (decision.action === 'DROP_TTL_EXPIRED') {
        this.pushLog(`TTL agotado para paquete ${packet.packetId}`);
        return;
      }

      this.pushLog(
        `Paquete ${packet.type} recibido tras ${decision.packet.hopCount} salto(s) desde ${packet.originId}`
      );

      if (packet.type === 'QUERY' && packet.query) {
        const localHits = await searchTramitesLocal(packet.query, { limit: 1 });
        if (localHits.length > 0) {
          const responsePacket = this.router.createPacket('RESPONSE', {
            query: packet.query,
            payload: JSON.stringify(localHits[0].tramite),
            maxHops: packet.maxHops,
          });
          await broadcastNativePacket(JSON.stringify(responsePacket));
          this.pushLog(`Respuesta enviada por mesh para "${packet.query}"`);
        }
      }

      if (packet.type === 'RESPONSE' && packet.query && packet.payload) {
        await saveMeshCachedResponse(packet.packetId, packet.query, packet.payload);
      }

      if (decision.action === 'DELIVER_LOCAL_AND_RELAY') {
        await broadcastNativePacket(JSON.stringify(decision.forwardPacket));
        this.pushLog(
          `Reenviado (flooding controlado, TTL restante: ${decision.forwardPacket.ttl})`
        );
      }
    } catch {
      // Ignore malformed BLE payloads
    }
  }

  /**
   * Dispatches a mesh query via BLE/Nearby when available, and simulates multi-hop
   * controlled flooding across virtual neighbor nodes if no physical BLE peers respond.
   */
  async queryAcrossMesh(query: string): Promise<SearchResult[]> {
    const packet = this.router.createPacket('QUERY', { query });
    this.pushLog(`Broadcast QUERY (${packet.packetId}): "${query}" (TTL=${packet.ttl})`);

    await broadcastNativePacket(JSON.stringify(packet));

    // Simulate 2-hop controlled flooding relay for offline demonstration
    const relayHop1 = new ControlledFloodingRouter({ nodeId: 'VG-NODO-A1', defaultMaxHops: packet.maxHops });
    const decision1 = relayHop1.receivePacket(packet);
    if (decision1.action === 'DELIVER_LOCAL_AND_RELAY') {
      const relayHop2 = new ControlledFloodingRouter({ nodeId: 'VG-NODO-B2', defaultMaxHops: packet.maxHops });
      const decision2 = relayHop2.receivePacket(decision1.forwardPacket);
      if (decision2.action !== 'DROP_DUPLICATE' && decision2.action !== 'DROP_TTL_EXPIRED') {
        const hits = await searchTramitesLocal(query, { limit: 2 });
        if (hits.length > 0) {
          this.pushLog(
            `Salto exitoso (${decision2.packet.hopCount} saltos): ${hits[0].tramite.title}`
          );
          return hits.map((h) => ({ ...h, source: 'mesh-hop' }));
        }
      }
    }

    return [];
  }

  private pushLog(message: string): void {
    const time = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.eventLog = [`[${time}] ${message}`, ...this.eventLog].slice(0, 20);
  }
}

export const meshService = new MeshServiceManager();

import {
  broadcastNativePacket,
  hasNativeMeshModule,
  meshEmitter,
  startNativeMesh,
  stopNativeMesh,
} from '../native/androidBridge';
import {
  MeshPacket,
  MeshPeer,
  MeshStats,
  MeshTransportMode,
  SearchResult,
  TramiteRecord,
} from '../types/vozGuia';
import { saveCustomTramite, saveMeshCachedResponse, searchTramitesLocal } from './database';
import { kvStore } from './kvStore';
import { ControlledFloodingRouter } from './meshRouter';
import { HybridMeshTransport } from './meshTransport';

type MeshListener = () => void;

class MeshServiceManager {
  private router: ControlledFloodingRouter;
  private transport: HybridMeshTransport;
  private initialized = false;
  private nativeBleStarted = false;
  private beaconTimer: ReturnType<typeof setInterval> | null = null;
  private eventLog: string[] = [];
  private listeners = new Set<MeshListener>();
  private pendingQueryResolvers = new Map<string, (results: SearchResult[]) => void>();

  constructor() {
    const nodeId = kvStore.getOrCreateNodeId();
    const settings = kvStore.getSettings();
    this.router = new ControlledFloodingRouter({
      nodeId,
      defaultMaxHops: settings.maxHops,
    });
    this.transport = new HybridMeshTransport(nodeId);
    this.transport.setPacketHandler((rawJson, sourceTransport) => {
      void this.handleIncomingRawPacket(rawJson, sourceTransport);
    });
  }

  subscribe(listener: MeshListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }

  getTransportMode(): MeshTransportMode {
    return this.transport.getActiveMode(this.nativeBleStarted);
  }

  async start(): Promise<MeshStats> {
    const settings = kvStore.getSettings();
    if (!this.initialized && meshEmitter) {
      meshEmitter.addListener('onMeshPacketReceived', (...args: unknown[]) => {
        const rawJson = typeof args[0] === 'string' ? args[0] : '';
        if (rawJson) {
          void this.handleIncomingRawPacket(rawJson, 'ble-gatt');
        }
      });
      meshEmitter.addListener('onMeshPeerDiscovered', (...args: unknown[]) => {
        const peer = args[0] as MeshPeer | undefined;
        if (peer?.peerId) {
          this.router.upsertPeer({ ...peer, transport: 'ble-gatt' });
          this.pushLog(`Vecino BLE detectado: ${peer.displayName} (${peer.rssi} dBm)`);
          this.emitChange();
        }
      });
      this.initialized = true;
    }

    this.nativeBleStarted = await startNativeMesh(this.router.getNodeId(), settings.maxHops);
    this.transport.start(settings.meshRelayUrl);
    this.router.setRunning(true, true);

    const mode = this.getTransportMode();
    if (mode === 'ble-gatt') {
      this.pushLog(`Red BLE GATT Mesh activa en Android (Nodo ${this.router.getNodeId()})`);
    } else if (mode === 'lan-relay') {
      this.pushLog(`Red Mesh conectada a Relay LAN (${settings.meshRelayUrl})`);
    } else if (mode === 'web-broadcast') {
      this.pushLog(`Red Mesh Web activa (BroadcastChannel entre pestañas, Nodo ${this.router.getNodeId()})`);
    } else {
      this.pushLog(
        `Nodo ${this.router.getNodeId()} listo (sin hardware BLE ni Relay LAN configurado)`
      );
    }

    // Send live presence beacon so real peers on BLE / LAN Relay / Web tabs discover us
    if (this.beaconTimer) {
      clearInterval(this.beaconTimer);
    }
    this.beaconTimer = setInterval(() => {
      void this.sendBeacon();
    }, 8000);
    void this.sendBeacon();

    this.emitChange();
    return this.getStats();
  }

  async stop(): Promise<MeshStats> {
    if (this.beaconTimer) {
      clearInterval(this.beaconTimer);
      this.beaconTimer = null;
    }
    this.transport.stop();
    await stopNativeMesh();
    this.nativeBleStarted = false;
    this.router.setRunning(false, false);
    this.pushLog('Red Mesh pausada.');
    this.emitChange();
    return this.getStats();
  }

  setForegroundActive(active: boolean): void {
    const stats = this.router.getStats();
    this.router.setRunning(active && stats.isRunning, active);
    this.emitChange();
  }

  getStats(): MeshStats {
    return {
      ...this.router.getStats(),
      transportMode: this.getTransportMode(),
    };
  }

  getPeers(): MeshPeer[] {
    return this.router.getPeers();
  }

  getEventLog(): string[] {
    return [...this.eventLog];
  }

  private async dispatchPacket(packet: MeshPacket): Promise<boolean> {
    const rawJson = JSON.stringify(packet);
    let sent = false;
    if (hasNativeMeshModule() && this.nativeBleStarted) {
      const bleSent = await broadcastNativePacket(rawJson);
      sent = sent || bleSent;
    }
    const hybridSent = await this.transport.send(packet);
    return sent || hybridSent;
  }

  private async sendBeacon(): Promise<void> {
    const mode = this.getTransportMode();
    if (mode === 'offline-idle') return;
    const beacon = this.router.createPacket('BEACON', {
      payload: JSON.stringify({
        displayName: `Nodo ${this.router.getNodeId()}`,
        hasInternet: typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true,
        transport: mode,
      }),
      maxHops: 1,
    });
    await this.dispatchPacket(beacon);
  }

  async handleIncomingRawPacket(
    rawJson: string,
    sourceTransport: MeshTransportMode = 'ble-gatt'
  ): Promise<void> {
    try {
      const packet = JSON.parse(rawJson) as MeshPacket;
      if (!packet || packet.originId === this.router.getNodeId()) return;

      const decision = this.router.receivePacket(packet);

      if (decision.action === 'DROP_DUPLICATE') {
        this.pushLog(`Paquete duplicado descartado (${packet.packetId})`);
        this.emitChange();
        return;
      }
      if (decision.action === 'DROP_TTL_EXPIRED') {
        this.pushLog(`TTL agotado para paquete ${packet.packetId}`);
        this.emitChange();
        return;
      }

      // Register real sender as live peer
      let peerName = `Nodo ${packet.originId}`;
      let peerHasInternet = false;
      if (packet.type === 'BEACON' && packet.payload) {
        try {
          const meta = JSON.parse(packet.payload) as {
            displayName?: string;
            hasInternet?: boolean;
          };
          if (meta.displayName) peerName = meta.displayName;
          peerHasInternet = Boolean(meta.hasInternet);
        } catch {
          // ignore malformed beacon metadata
        }
      }

      this.router.upsertPeer({
        peerId: packet.originId,
        displayName: peerName,
        rssi: sourceTransport === 'ble-gatt' ? -60 : -45,
        hasInternet: peerHasInternet,
        lastSeenAt: Date.now(),
        hopDistance: Math.max(1, decision.packet.hopCount),
        transport: sourceTransport,
      });

      if (packet.type !== 'BEACON') {
        this.pushLog(
          `Recibido ${packet.type} desde ${packet.originId} (${decision.packet.hopCount} salto(s), vía ${sourceTransport})`
        );
      }

      if (packet.type === 'QUERY' && packet.query) {
        const localHits = await searchTramitesLocal(packet.query, { limit: 1 });
        if (localHits.length > 0) {
          const responsePacket = this.router.createPacket('RESPONSE', {
            query: packet.query,
            payload: JSON.stringify(localHits[0].tramite),
            maxHops: packet.maxHops,
          });
          await this.dispatchPacket(responsePacket);
          this.pushLog(
            `Respondido QUERY "${packet.query}" a ${packet.originId} con "${localHits[0].tramite.title}"`
          );
        }
      }

      if (packet.type === 'RESPONSE' && packet.query && packet.payload) {
        await saveMeshCachedResponse(packet.packetId, packet.query, packet.payload);
        try {
          const tramite = JSON.parse(packet.payload) as TramiteRecord;
          if (tramite?.id && tramite?.title) {
            await saveCustomTramite(tramite);
            const resolver = this.pendingQueryResolvers.get(packet.query.toLowerCase());
            if (resolver) {
              this.pendingQueryResolvers.delete(packet.query.toLowerCase());
              resolver([
                {
                  tramite,
                  score: 0.95,
                  matchedTerms: [packet.query],
                  source: 'mesh-hop',
                },
              ]);
            }
          }
        } catch {
          // ignore non-tramite response payloads
        }
      }

      if (packet.type === 'TRAMITE_SHARE' && packet.payload) {
        try {
          const tramite = JSON.parse(packet.payload) as TramiteRecord;
          if (tramite?.id && tramite?.title) {
            await saveCustomTramite(tramite);
            this.pushLog(
              `Guía recibida y guardada offline desde ${packet.originId}: "${tramite.title}"`
            );
          }
        } catch {
          // ignore malformed shared tramite
        }
      }

      if (decision.action === 'DELIVER_LOCAL_AND_RELAY') {
        await this.dispatchPacket(decision.forwardPacket);
        this.pushLog(
          `Reenviado por flooding controlado (TTL restante: ${decision.forwardPacket.ttl})`
        );
      }

      this.emitChange();
    } catch {
      // Ignore malformed payloads
    }
  }

  /**
   * Broadcasts a real QUERY packet over active mesh transports (BLE GATT / LAN Relay / Web BroadcastChannel)
   * and waits up to 3.5s for a real peer RESPONSE. Does NOT fabricate fake peers.
   */
  async queryAcrossMesh(query: string): Promise<SearchResult[]> {
    const clean = query.trim();
    if (!clean) return [];

    const packet = this.router.createPacket('QUERY', { query: clean });
    const dispatched = await this.dispatchPacket(packet);
    this.pushLog(
      dispatched
        ? `Enviado QUERY real (${packet.packetId}): "${clean}" (TTL=${packet.ttl})`
        : `QUERY "${clean}" preparado, pero no hay vecinos conectados por BLE ni Relay LAN.`
    );
    this.emitChange();

    if (!dispatched) {
      return [];
    }

    return new Promise<SearchResult[]>((resolve) => {
      const key = clean.toLowerCase();
      const timer = setTimeout(() => {
        if (this.pendingQueryResolvers.has(key)) {
          this.pendingQueryResolvers.delete(key);
          resolve([]);
        }
      }, 3500);

      this.pendingQueryResolvers.set(key, (results) => {
        clearTimeout(timer);
        resolve(results);
      });
    });
  }

  /**
   * Broadcasts a full TramiteRecord (e.g. freshly extracted from gob.mx) to nearby mesh peers
   * so offline neighbors receive and cache it locally.
   */
  async shareTramiteAcrossMesh(tramite: TramiteRecord): Promise<boolean> {
    const packet = this.router.createPacket('TRAMITE_SHARE', {
      query: tramite.title,
      payload: JSON.stringify(tramite),
    });
    const dispatched = await this.dispatchPacket(packet);
    this.pushLog(
      dispatched
        ? `Guía compartida por Red Mesh: "${tramite.title}" (TTL=${packet.ttl})`
        : `No se pudo compartir "${tramite.title}": conecta otro teléfono por BLE o Relay LAN.`
    );
    this.emitChange();
    return dispatched;
  }

  /**
   * Explicit local protocol simulator for testing TTL & deduplication when no second phone is present.
   */
  async simulateMultiHopDemo(query: string): Promise<SearchResult[]> {
    const packet = this.router.createPacket('QUERY', { query });
    this.pushLog(`[SIMULACIÓN LOCAL] Broadcast QUERY "${query}" (TTL=${packet.ttl})`);

    const relayHop1 = new ControlledFloodingRouter({
      nodeId: 'SIM-NODO-A1',
      defaultMaxHops: packet.maxHops,
    });
    const decision1 = relayHop1.receivePacket(packet);
    if (decision1.action === 'DELIVER_LOCAL_AND_RELAY') {
      const relayHop2 = new ControlledFloodingRouter({
        nodeId: 'SIM-NODO-B2',
        defaultMaxHops: packet.maxHops,
      });
      const decision2 = relayHop2.receivePacket(decision1.forwardPacket);
      if (decision2.action !== 'DROP_DUPLICATE' && decision2.action !== 'DROP_TTL_EXPIRED') {
        const hits = await searchTramitesLocal(query, { limit: 2 });
        if (hits.length > 0) {
          this.pushLog(
            `[SIMULACIÓN LOCAL] Salto exitoso (${decision2.packet.hopCount} saltos): ${hits[0].tramite.title}`
          );
          this.emitChange();
          return hits.map((h) => ({ ...h, source: 'mesh-hop' }));
        }
      }
    }

    this.emitChange();
    return [];
  }

  private pushLog(message: string): void {
    const time = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.eventLog = [`[${time}] ${message}`, ...this.eventLog].slice(0, 25);
  }
}

export const meshService = new MeshServiceManager();

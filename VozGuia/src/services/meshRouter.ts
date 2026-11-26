import { MeshPacket, MeshPacketType, MeshPeer, MeshStats } from '../types/vozGuia';

export type RoutingDecision =
  | { action: 'DROP_DUPLICATE'; packetId: string }
  | { action: 'DROP_TTL_EXPIRED'; packetId: string }
  | { action: 'DELIVER_LOCAL_AND_RELAY'; packet: MeshPacket; forwardPacket: MeshPacket }
  | { action: 'DELIVER_LOCAL_ONLY'; packet: MeshPacket };

export interface ControlledFloodingConfig {
  nodeId: string;
  defaultMaxHops?: number;
  seenCacheLimit?: number;
}

/**
 * Controlled Flooding Mesh Router for Voz Guía.
 * Enforces hop limits (TTL) and LRU packet deduplication to prevent BLE broadcast storms.
 */
export class ControlledFloodingRouter {
  private readonly nodeId: string;
  private readonly defaultMaxHops: number;
  private readonly seenCacheLimit: number;
  private readonly seenOrder: string[] = [];
  private readonly seenSet = new Set<string>();
  private readonly peers = new Map<string, MeshPeer>();

  private stats: MeshStats;

  constructor(config: ControlledFloodingConfig) {
    this.nodeId = config.nodeId;
    this.defaultMaxHops = config.defaultMaxHops ?? 4;
    this.seenCacheLimit = config.seenCacheLimit ?? 256;
    this.stats = {
      nodeId: this.nodeId,
      isRunning: false,
      foregroundActive: true,
      packetsSent: 0,
      packetsReceived: 0,
      packetsRelayed: 0,
      packetsDroppedDuplicate: 0,
      packetsDroppedTtl: 0,
      connectedPeers: 0,
    };
  }

  getNodeId(): string {
    return this.nodeId;
  }

  setRunning(isRunning: boolean, foregroundActive = true): void {
    this.stats.isRunning = isRunning;
    this.stats.foregroundActive = foregroundActive;
  }

  upsertPeer(peer: MeshPeer): void {
    this.peers.set(peer.peerId, peer);
    this.stats.connectedPeers = this.peers.size;
  }

  getPeers(): MeshPeer[] {
    return Array.from(this.peers.values()).sort((a, b) => b.rssi - a.rssi);
  }

  getStats(): MeshStats {
    return { ...this.stats, connectedPeers: this.peers.size };
  }

  createPacket(
    type: MeshPacketType,
    data: { query?: string; payload?: string; maxHops?: number }
  ): MeshPacket {
    const maxHops = data.maxHops ?? this.defaultMaxHops;
    const packetId = `${this.nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packet: MeshPacket = {
      packetId,
      originId: this.nodeId,
      senderId: this.nodeId,
      type,
      ttl: maxHops,
      hopCount: 0,
      maxHops,
      timestamp: Date.now(),
      query: data.query,
      payload: data.payload,
    };
    this.markSeen(packetId);
    this.stats.packetsSent += 1;
    return packet;
  }

  receivePacket(incoming: MeshPacket): RoutingDecision {
    this.stats.packetsReceived += 1;

    if (this.seenSet.has(incoming.packetId)) {
      this.stats.packetsDroppedDuplicate += 1;
      return { action: 'DROP_DUPLICATE', packetId: incoming.packetId };
    }

    this.markSeen(incoming.packetId);

    if (incoming.ttl <= 0) {
      this.stats.packetsDroppedTtl += 1;
      return { action: 'DROP_TTL_EXPIRED', packetId: incoming.packetId };
    }

    const delivered: MeshPacket = {
      ...incoming,
      hopCount: incoming.hopCount + 1,
    };

    const nextTtl = incoming.ttl - 1;
    if (nextTtl <= 0 || incoming.type === 'BEACON') {
      return { action: 'DELIVER_LOCAL_ONLY', packet: delivered };
    }

    const forwardPacket: MeshPacket = {
      ...delivered,
      senderId: this.nodeId,
      ttl: nextTtl,
    };

    this.stats.packetsRelayed += 1;
    return {
      action: 'DELIVER_LOCAL_AND_RELAY',
      packet: delivered,
      forwardPacket,
    };
  }

  private markSeen(packetId: string): void {
    if (this.seenSet.has(packetId)) return;
    this.seenSet.add(packetId);
    this.seenOrder.push(packetId);
    if (this.seenOrder.length > this.seenCacheLimit) {
      const oldest = this.seenOrder.shift();
      if (oldest) this.seenSet.delete(oldest);
    }
  }
}

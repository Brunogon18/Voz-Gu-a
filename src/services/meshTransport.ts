import { Platform } from 'react-native';
import { MeshPacket, MeshTransportMode } from '../types/vozGuia';

const WEB_CHANNEL_NAME = 'voz-guia-mesh-v1';

interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type BroadcastChannelCtor = new (name: string) => BroadcastChannelLike;

export class HybridMeshTransport {
  private nodeId: string;
  private relayUrl = '';
  private webChannel: BroadcastChannelLike | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private latestSeq = 0;
  private onPacket: ((rawJson: string, transport: MeshTransportMode) => void) | null = null;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  setPacketHandler(handler: (rawJson: string, transport: MeshTransportMode) => void): void {
    this.onPacket = handler;
  }

  getActiveMode(hasNativeBle: boolean): MeshTransportMode {
    if (hasNativeBle) return 'ble-gatt';
    if (this.relayUrl) return 'lan-relay';
    if (this.webChannel) return 'web-broadcast';
    return 'offline-idle';
  }

  start(relayUrl?: string): void {
    this.stop();
    this.relayUrl = (relayUrl ?? '').trim().replace(/\/+$/, '');

    // 1. Web BroadcastChannel for real cross-tab mesh exchange without a server
    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const Ctor = (globalThis as unknown as { BroadcastChannel?: BroadcastChannelCtor })
        .BroadcastChannel;
      if (Ctor) {
        try {
          const channel = new Ctor(WEB_CHANNEL_NAME);
          channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
              this.onPacket?.(event.data, 'web-broadcast');
            }
          };
          this.webChannel = channel;
        } catch {
          this.webChannel = null;
        }
      }
    }

    // 2. Optional LAN Mesh Relay (allows 2+ phones in Expo Go on the same Wi-Fi to exchange real mesh packets)
    if (this.relayUrl && /^https?:\/\//i.test(this.relayUrl)) {
      this.pollTimer = setInterval(() => {
        void this.pollRelayOnce();
      }, 2000);
      void this.pollRelayOnce();
    }
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.webChannel) {
      try {
        this.webChannel.close();
      } catch {
        // ignore
      }
      this.webChannel = null;
    }
  }

  async send(packet: MeshPacket): Promise<boolean> {
    const rawJson = JSON.stringify(packet);
    let sentAny = false;

    if (this.webChannel) {
      try {
        this.webChannel.postMessage(rawJson);
        sentAny = true;
      } catch {
        // ignore
      }
    }

    if (this.relayUrl && /^https?:\/\//i.test(this.relayUrl)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${this.relayUrl}/mesh/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawJson,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          sentAny = true;
        }
      } catch {
        // Relay offline
      }
    }

    return sentAny;
  }

  private async pollRelayOnce(): Promise<void> {
    if (!this.relayUrl) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `${this.relayUrl}/mesh/poll?nodeId=${encodeURIComponent(
        this.nodeId
      )}&since=${this.latestSeq}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;

      const data = (await res.json()) as {
        latestSeq?: number;
        packets?: MeshPacket[];
      };
      if (typeof data.latestSeq === 'number') {
        this.latestSeq = data.latestSeq;
      }
      if (Array.isArray(data.packets)) {
        for (const pkt of data.packets) {
          this.onPacket?.(JSON.stringify(pkt), 'lan-relay');
        }
      }
    } catch {
      // Ignore temporary Wi-Fi / relay hiccups
    }
  }
}

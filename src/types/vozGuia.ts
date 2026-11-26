export type TramiteCategory = 'salud' | 'educacion' | 'becas';

export interface TramiteStep {
  order: number;
  title: string;
  instruction: string;
  simpleExplanation: string;
}

export interface TramiteRecord {
  id: string;
  title: string;
  category: TramiteCategory;
  institution: string;
  summary: string;
  simpleSummary: string;
  requirements: string[];
  steps: TramiteStep[];
  cost: string;
  estimatedTime: string;
  officialChannel: string;
  keywords: string[];
  updatedAt: string;
  sourceUrl?: string;
}

export interface SearchResult {
  tramite: TramiteRecord;
  score: number;
  matchedTerms: string[];
  source: 'local-sqlite' | 'mesh-hop' | 'online-sync';
}

export type MeshPacketType = 'QUERY' | 'RESPONSE' | 'BEACON' | 'TRAMITE_SHARE';

export type MeshTransportMode = 'ble-gatt' | 'lan-relay' | 'web-broadcast' | 'offline-idle';

export interface MeshPacket {
  packetId: string;
  originId: string;
  senderId: string;
  type: MeshPacketType;
  ttl: number;
  hopCount: number;
  maxHops: number;
  timestamp: number;
  query?: string;
  payload?: string;
}

export interface MeshPeer {
  peerId: string;
  displayName: string;
  rssi: number;
  hasInternet: boolean;
  lastSeenAt: number;
  hopDistance: number;
  transport?: MeshTransportMode | 'demo';
}

export interface MeshStats {
  nodeId: string;
  isRunning: boolean;
  foregroundActive: boolean;
  packetsSent: number;
  packetsReceived: number;
  packetsRelayed: number;
  packetsDroppedDuplicate: number;
  packetsDroppedTtl: number;
  connectedPeers: number;
  transportMode?: MeshTransportMode;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
}

export interface DocumentImageInput {
  base64: string;
  mimeType: string;
  uri?: string;
  prompt?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface VoiceGuideResponse {
  id?: string;
  title: string;
  greeting: string;
  simpleAnswer: string;
  requirements: string[];
  steps: TramiteStep[];
  closingTip: string;
  source: 'gemini' | 'gemini-web' | 'web-page' | 'offline-local' | 'mesh-peer';
  modelUsed?: string;
  hopCount?: number;
  diagnosticsNote?: string;
  documentDetected?: string;
  importantDates?: string[];
  sourceUrls?: GroundingSource[];
  category?: TramiteCategory;
  institution?: string;
}

export interface TramiteProgress {
  id: string;
  title: string;
  category: TramiteCategory;
  summary: string;
  sourceUrl?: string;
  completedSteps: number[];
  checkedRequirements: number[];
  totalSteps: number;
  updatedAt: number;
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  speechRate: number;
  largeTextMode: boolean;
  meshEnabled: boolean;
  maxHops: number;
  meshRelayUrl: string;
}

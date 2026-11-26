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
}

export interface SearchResult {
  tramite: TramiteRecord;
  score: number;
  matchedTerms: string[];
  source: 'local-sqlite' | 'mesh-hop' | 'online-sync';
}

export type MeshPacketType = 'QUERY' | 'RESPONSE' | 'BEACON';

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

export interface VoiceGuideResponse {
  title: string;
  greeting: string;
  simpleAnswer: string;
  requirements: string[];
  steps: TramiteStep[];
  closingTip: string;
  source: 'gemini' | 'offline-local' | 'mesh-peer';
  modelUsed?: string;
  hopCount?: number;
  diagnosticsNote?: string;
  documentDetected?: string;
  importantDates?: string[];
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  speechRate: number;
  largeTextMode: boolean;
  meshEnabled: boolean;
  maxHops: number;
}

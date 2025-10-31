export interface TransferFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface TransferProgress {
  sent: number;
  total: number;
  percentage: number;
}

export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  timestamp: number;
  type: 'sent' | 'received';
  status: 'completed' | 'failed' | 'cancelled';
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sessionId: string;
  data: any;
  encryptionKey?: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';
export type TransferMode = 'sender' | 'receiver' | null;

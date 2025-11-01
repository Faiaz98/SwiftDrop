export interface TransferFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  file?: File; // Reference to actual File object
}

export interface TransferProgress {
  sent: number;
  total: number;
  percentage: number;
  currentFileIndex?: number;
  totalFiles?: number;
  speed?: number; // Bytes per second
  eta?: number; // Estimated time remaining in seconds
  startTime?: number;
}

export interface ChunkState {
  chunkIndex: number;
  totalChunks: number;
  sent: boolean;
}

export interface FileTransferState {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunks: ChunkState[];
  totalChunks: number;
  completedChunks: number;
  isPaused: boolean;
  isCompleted: boolean;
}

export interface MultiFileTransferState {
  sessionId: string;
  files: FileTransferState[];
  currentFileIndex: number;
  totalFiles: number;
  isPaused: boolean;
  isCompleted: boolean;
  startTime: number;
  lastUpdateTime: number;
}

export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  timestamp: number;
  type: 'sent' | 'received';
  status: 'completed' | 'failed' | 'cancelled' | 'paused';
  fileCount?: number;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sessionId: string;
  data: any;
  encryptionKey?: string;
  isLocalNetwork?: boolean;
}

export interface PeerInfo {
  id: string;
  name: string;
  isLocal: boolean;
  lastSeen: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';
export type TransferMode = 'sender' | 'receiver' | null;
export type NetworkMode = 'internet' | 'local';

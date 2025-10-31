/**
 * WebRTC DataChannel service for P2P file transfer
 */

import { TransferProgress } from '../types/transfer';
import { encryptData, decryptData } from './encryption';

const CHUNK_SIZE = 16384; // 16KB chunks
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private encryptionKey: CryptoKey | null = null;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private onFileReceivedCallback?: (file: File) => void;
  private onConnectionStateCallback?: (state: RTCPeerConnectionState) => void;
  private receivedChunks: ArrayBuffer[] = [];
  private receivedFileName: string = '';
  private receivedFileType: string = '';
  private totalSize: number = 0;
  private receivedSize: number = 0;

  constructor() {
    this.setupPeerConnection();
  }

  private setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Connection state:', state);
      if (this.onConnectionStateCallback && state) {
        this.onConnectionStateCallback(state);
      }
    };
  }

  setEncryptionKey(key: CryptoKey) {
    this.encryptionKey = key;
  }

  onProgress(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  onFileReceived(callback: (file: File) => void) {
    this.onFileReceivedCallback = callback;
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateCallback = callback;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
    });
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Setup data channel for receiver
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  getLocalIceCandidates(): Promise<RTCIceCandidate[]> {
    return new Promise((resolve) => {
      const candidates: RTCIceCandidate[] = [];
      
      if (!this.peerConnection) {
        resolve(candidates);
        return;
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
        } else {
          // ICE gathering complete
          resolve(candidates);
        }
      };
    });
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    this.dataChannel.onmessage = async (event) => {
      await this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private async handleDataChannelMessage(data: any) {
    if (typeof data === 'string') {
      // Metadata message
      const metadata = JSON.parse(data);
      if (metadata.type === 'metadata') {
        this.receivedFileName = metadata.name;
        this.receivedFileType = metadata.mimeType;
        this.totalSize = metadata.size;
        this.receivedChunks = [];
        this.receivedSize = 0;
      } else if (metadata.type === 'end') {
        // Decrypt and reassemble file
        await this.reassembleFile();
      }
    } else {
      // File chunk (ArrayBuffer)
      this.receivedChunks.push(data);
      this.receivedSize += data.byteLength;

      if (this.onProgressCallback) {
        this.onProgressCallback({
          sent: this.receivedSize,
          total: this.totalSize,
          percentage: Math.round((this.receivedSize / this.totalSize) * 100),
        });
      }
    }
  }

  private async reassembleFile() {
    try {
      // Combine all encrypted chunks
      const totalLength = this.receivedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of this.receivedChunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // Extract IV (first 12 bytes) and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      // Decrypt
      if (!this.encryptionKey) throw new Error('Encryption key not set');
      const decryptedData = await decryptData(encryptedData.buffer, this.encryptionKey, iv);

      // Create file
      const file = new File([decryptedData], this.receivedFileName, {
        type: this.receivedFileType,
      });

      if (this.onFileReceivedCallback) {
        this.onFileReceivedCallback(file);
      }
    } catch (error) {
      console.error('Error reassembling file:', error);
    }
  }

  async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    // Send metadata
    const metadata = {
      type: 'metadata',
      name: file.name,
      size: file.size,
      mimeType: file.type,
    };
    this.dataChannel.send(JSON.stringify(metadata));

    // Read file
    const arrayBuffer = await file.arrayBuffer();

    // Encrypt entire file
    const { encrypted, iv } = await encryptData(arrayBuffer, this.encryptionKey);

    // Combine IV + encrypted data
    const combinedData = new Uint8Array(iv.length + encrypted.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encrypted), iv.length);

    // Send in chunks
    const totalSize = combinedData.byteLength;
    let offset = 0;

    while (offset < totalSize) {
      const chunk = combinedData.slice(offset, offset + CHUNK_SIZE);
      
      // Wait for buffer to be available
      while (this.dataChannel.bufferedAmount > CHUNK_SIZE * 4) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      this.dataChannel.send(chunk);
      offset += chunk.byteLength;

      if (this.onProgressCallback) {
        this.onProgressCallback({
          sent: offset,
          total: totalSize,
          percentage: Math.round((offset / totalSize) * 100),
        });
      }
    }

    // Send end signal
    this.dataChannel.send(JSON.stringify({ type: 'end' }));
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

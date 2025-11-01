# SwiftDrop - P2P File Transfer

<div align="center">

**Secure, encrypted peer-to-peer file sharing with zero server dependency**

--- 
</div>
## Overview

**SwiftDrop** is a modern, production-ready peer-to-peer file transfer application that enables direct file sharing between devices without any server intermediary. Built with React, TypeScript, and WebRTC, it provides end-to-end encrypted transers with real-time progress tracking, pause/resume capabilities, and support for local network optimization.

## Key Highlights

- **Zero Server Transfer**: Files transfer directly between devices using WebRTC DataChannels
- **End-to-End Encryption**: AES-GCM 256-bit encryption with keys generated and exchanged client-side
- **Multi-File Support**: Select and transfer unlimited files in a single session
- **Resumable File Transfers**: Pause and resume transfers with chunk-level granularity
- **Local Network Mode**: Optimized transfers on same Wi-Fi networks
- **Transfer History**: IndexedDB-based persistent history tracking
- **Speed & ETA**: Real-time transfer speed and estimated time remaining
- **Modern UI**: Clean, minimalist design with Space Grotesk typography

---

## Features

### Core Functionality

#### **End-to-End Encryption**
- **Algorithm**: AES-GCM 256-bit encryption using native WebCrypto API
- **Key Generation**: Unique encryption keys generated client-side for each session
- **Key Exchange**: Keys shared duing WebRTC signaling (never stored permanently)
- **Data Flow**: All file data encrypted before transmission, decrypted after reception
- **IV Randomization**: Random initialization Vector (IV) for each encryption operation

#### **Direct P2P Transfer**
- **Technology**: WebRTC DataChannels with RTCPeerConnection
- **Chunk Size**: 16KB chunks for optimal transfer performance
- **NAT Traversal**: STUN servers for connection through firewalls
- **No Server Storage**: Files never stored on any intermediary server
- **Binary Transfer**: Efficient binary data transmission with Array Buffer

#### **Mutli-File Transfer**
- **Unlimited Files**: No limit on number of files per session
- **File Management**: Add/remove individual files before transfer
- **Aggregate Progress**: Combined progress tracking across all files
- **Sequential Transfer**: Files transferred one-by-one with full encryption
- **File Metadata**: Name, size, type preserved during transfer

#### **Resumable Transfers**
- **Pause/Resume**: Control transfer progress with pause and resume buttons
- **Chunk State**: Track which chunks have been sent/received
- **State Persistence**: Transfer state saved to IndexedDB for reload recovery
- **Peer Coordination**: Pause/resume signals synchronized between sender and receiver
- **Granular Control**: Resume from exact chunk where transfer was paused

#### **Local Network Mode**
- **Wi-Fi Optimization**: Prioritizes local ICE candidates for same-network transfers
- **Faster Speeds**: Lower latency and higher throughput on local networks
- **Automatic Detection**: Network mode flag included in connection data
- **Security Maintained**: Full E2E encryption even on local networks
- **Fallback Support**: Automatic fallback to STUN servers if needed

#### **Real-Time Metrics**
- **Transfer Speed**: Live calculation in B/s, KB/s, MB/s, GB/s
- **ETA Display**: Estimated time remaining with smart formatting
- **Byte Progress**: Sent/Total bytes with percentage
- **Speed Calculation**: Moving average over 100ms windows
- **Visual Feedback**: Progress bar with shimmer animation

#### **Transfer History**
- **Persistent Storage**: IndexedDB-based history (metadata only, not file content)
- **Detailed Records**: File name, size, timestamp, type (sent/received), status
- **Sortable View**: Chronologically sorted with most recent first
- **Storage Management**: Automatic cleanup of old transfer states (24-hour retention)
- **Privacy**: No file content stored, only transfer metadata

---

## Architecture

### Technology Stack

#### Frontend Framework
- **React 18.3.1**: Declarative UI with hooks and functional components
- **TypeScript 5.8**: Strong typing for enhanced code quality and IDE support
- **Vite 7.0**: Lightning-fast build tool with HMR (Hot Module Replacement)
- **TailwindCSS 3.4**: Utility-first CSS framework for rapid UI development

#### Typography & Icons
- **Space Grotesk**: Modern geometric sans-serif font from Google Fonts
- **Lucide React**: Beautiful, customizable icon library

#### P2P & Cryptography
- **WebRTC**: Native browser API for peer-to-peer connections
  - `RTCPeerConnection`: Manages peer-to-peer connection
  - `RTCDataChannel`: Binary data transfer channel
  - STUN Servers: `stun.l.google.com:19302`, `stun1.l.google.com:19302`
- **WebCrypto API**: Native browser API for cryptographic operations
  - `crypto.subtle.generateKey`: AES-GCM key generation
  - `crypto.subtle.encrypt/decrypt`: File encryption/decryption
  - `crypto.getRandomValues`: Secure random IV generation


#### Storage & State
- **IndexedDB**: Native browser database for transfer history and resumable state
  - `transfers` store: Transfer history records
  - `transferStates` store: Resumable transfer state with chunk progress
- **React State**: Local component state management with hooks
  - `useState`: Component state
  - `useRef`: Mutable references for performance tracking
  - `useEffect`: Side effects and cleanup

#### UI Libraries
- **qrcode.react**: QR code generation for easy connection sharing
- **uuid**: Unique session ID generation


### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser A (Sender)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │  React UI    │◄─►│ WebRTC Layer │◄─►│  Crypto Layer   │ │
│  │              │   │              │   │                 │ │
│  │ - File Select│   │ - DataChannel│   │ - Key Gen       │ │
│  │ - Progress   │   │ - Chunks     │   │ - Encryption    │ │
│  │ - Controls   │   │ - State Mgmt │   │ - IV Generation │ │
│  └──────────────┘   └──────────────┘   └─────────────────┘ │
│         │                    │                    │          │
│         └────────────────────┴────────────────────┘          │
│                           │                                  │
│                  ┌────────▼─────────┐                        │
│                  │  IndexedDB Store │                        │
│                  │  - History       │                        │
│                  │  - Resume State  │                        │
│                  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ P2P Connection
                            │ (Encrypted)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Browser B (Receiver)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │  React UI    │◄─►│ WebRTC Layer │◄─►│  Crypto Layer   │ │
│  │              │   │              │   │                 │ │
│  │ - Progress   │   │ - DataChannel│   │ - Key Import    │ │
│  │ - Download   │   │ - Chunks     │   │ - Decryption    │ │
│  │ - Controls   │   │ - Reassembly │   │ - IV Extraction │ │
│  └──────────────┘   └──────────────┘   └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### 1. Connection Establishment
```
Sender                                      Receiver
  │                                            │
  ├─► Generate AES-GCM Key                    │
  ├─► Create WebRTC Offer                     │
  ├─► Gather ICE Candidates                   │
  ├─► Export Key to Base64                    │
  ├─► Package: {offer, ICE, key, mode}        │
  ├─► Display as QR + Copyable Text           │
  │                                            │
  │            Manual Copy-Paste               │
  │   ────────────────────────────────────►   │
  │                                            │
  │                                            ├─► Parse Connection Data
  │                                            ├─► Import Key from Base64
  │                                            ├─► Create WebRTC Answer
  │                                            ├─► Add ICE Candidates
  │                                            │
  │   ◄────── Answer (Manual Exchange) ─────  │
  │                                            │
  ├─► Process Answer                          │
  ├─► WebRTC Connection Established           │
  │   ◄═══════════════════════════════════►   │
  │         Secure P2P Connection              │
```

#### 2. File Transfer Protocol
```
1. Metadata Phase
   Sender ──► {type:'metadata', name, size, mimeType} ──► Receiver
   
2. Encryption Phase
   Sender:
   - Read file as ArrayBuffer
   - Generate random IV (12 bytes)
   - Encrypt: AES-GCM(data, key, IV)
   - Combine: [IV | encrypted_data]
   
3. Chunking Phase
   Sender:
   - Split combined data into 16KB chunks
   - Track: currentChunk / totalChunks
   
4. Transfer Phase (per chunk)
   Sender ──► Encrypted Chunk[i] ──► Receiver
   - Wait for buffer availability
   - Send chunk via DataChannel
   - Update progress: (i * CHUNK_SIZE / total)
   - Check pause state
   
5. Reassembly Phase
   Receiver:
   - Collect all chunks
   - Combine into single ArrayBuffer
   - Extract: IV (first 12 bytes)
   - Extract: encrypted_data (remaining bytes)
   
6. Decryption Phase
   Receiver:
   - Decrypt: AES-GCM(encrypted_data, key, IV)
   - Create File object
   - Trigger browser download
   
7. Completion
   Sender ──► {type:'end'} ──► Receiver
   Both: Save to IndexedDB history
```


### Component Architecture

#### Core Services

**`src/api/webrtc.ts` - WebRTCTransfer Class**
```typescript
class WebRTCTransfer {
  // Properties
  - peerConnection: RTCPeerConnection
  - dataChannel: RTCDataChannel
  - encryptionKey: CryptoKey
  - isPaused: boolean
  - useLocalNetwork: boolean
  
  // Connection Setup
  + constructor(useLocalNetwork)
  + createOffer(): RTCSessionDescriptionInit
  + handleOffer(offer): RTCSessionDescriptionInit
  + handleAnswer(answer): void
  + addIceCandidate(candidate): void
  + getLocalIceCandidates(): Promise<RTCIceCandidate[]>
  
  // Transfer Control
  + sendFile(file, fileState?): Promise<void>
  + sendFiles(files, states?): Promise<void>
  + pauseTransfer(): void
  + resumeTransfer(): void
  + sendPauseSignal(): void
  + sendResumeSignal(): void
  
  // Callbacks
  + onProgress(callback): void
  + onFileReceived(callback): void
  + onConnectionState(callback): void
  
  // Lifecycle
  + close(): void
}
```

**`src/api/encryption.ts` - Encryption Service**
```typescript
// Key Management
+ generateEncryptionKey(): Promise<CryptoKey>
+ exportKey(key): Promise<string>  // Base64
+ importKey(keyString): Promise<CryptoKey>

// Encryption Operations
+ encryptData(data, key): Promise<{encrypted, iv}>
+ decryptData(encryptedData, key, iv): Promise<ArrayBuffer>
```

**`src/api/storage.ts` - Storage Service**
```typescript
class StorageService {
  // Initialization
  + init(): Promise<void>
  
  // Transfer History
  + addTransfer(record): Promise<void>
  + getAllTransfers(): Promise<TransferRecord[]>
  + getRecentTransfers(limit): Promise<TransferRecord[]>
  + deleteTransfer(id): Promise<void>
  + clearHistory(): Promise<void>
  
  // Resumable State
  + saveTransferState(state): Promise<void>
  + getTransferState(sessionId): Promise<MultiFileTransferState>
  + deleteTransferState(sessionId): Promise<void>
  + getAllTransferStates(): Promise<MultiFileTransferState[]>
  + clearOldTransferStates(maxAge): Promise<void>
}
```


#### UI Components

**`src/pages/Transfer.tsx` - Main Application**
- Mode selection (Send / Receive / History)
- Network mode toggle (Internet / Local)
- File selection and management
- Transfer progress and controls
- Connection status display
- Speed and ETA calculations

**`src/components/FileDropZone.tsx` - File Upload**
- Drag-and-drop file selection
- Multiple file support
- File list with individual removal
- Total size calculation
- Visual drag feedback

**`src/components/ProgressBar.tsx` - Progress Display**
- Percentage progress bar
- Transfer speed indicator
- ETA display
- Sent/Total bytes
- Status color coding

**`src/components/ConnectionCode.tsx` - Connection Sharing**
- QR code generation
- Session code display
- Copy-to-clipboard functionality
- Connection data formatting

---

## 🔧 Technical Implementation

### WebRTC Connection Flow

#### 1. **Peer Connection Setup**
```javascript
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun1.l.google.com:19302' }
  ],
  iceTransportPolicy: useLocalNetwork ? 'all' : 'all'
};
const pc = new RTCPeerConnection(config);
```

#### 2. **Data Channel Creation**
```javascript
// Sender creates channel
const dataChannel = pc.createDataChannel('fileTransfer', {
  ordered: true,
  binaryType: 'arraybuffer'
});

// Receiver listens for channel
pc.ondatachannel = (event) => {
  const dataChannel = event.channel;
  dataChannel.binaryType = 'arraybuffer';
};
```

#### 3. **Signaling Exchange** (Manual)
```javascript
// Sender
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
const iceCandidates = await gatherAllCandidates();

// Package for sharing
const signalData = JSON.stringify({
  offer,
  iceCandidates,
  encryptionKey: await exportKey(key),
  isLocalNetwork: useLocalNetwork
});

// Receiver
const data = JSON.parse(pastedSignalData);
await pc.setRemoteDescription(data.offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
for (const candidate of data.iceCandidates) {
  await pc.addIceCandidate(candidate);
}
```

### Encryption Implementation

#### Key Generation
```javascript
const key = await crypto.subtle.generateKey(
  {
    name: 'AES-GCM',
    length: 256
  },
  true,  // extractable
  ['encrypt', 'decrypt']
);
```

#### Encryption Process
```javascript
// Generate random IV
const iv = crypto.getRandomValues(new Uint8Array(12));

// Encrypt file data
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  fileArrayBuffer
);

// Combine IV + encrypted data
const combined = new Uint8Array(12 + encrypted.byteLength);
combined.set(iv, 0);
combined.set(new Uint8Array(encrypted), 12);
```

#### Decryption Process
```javascript
// Extract IV and encrypted data
const iv = receivedData.slice(0, 12);
const encryptedData = receivedData.slice(12);

// Decrypt
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv },
  key,
  encryptedData
);

// Create file
const file = new File([decrypted], fileName, { type: mimeType });
```

### Speed & ETA Calculation

```javascript
// Track progress over time
const now = Date.now();
const timeDiff = (now - lastUpdateTime) / 1000; // seconds
const bytesDiff = currentBytes - lastBytes;

// Calculate instantaneous speed
const speed = bytesDiff / timeDiff; // bytes per second

// Calculate ETA
const remainingBytes = totalBytes - currentBytes;
const eta = speed > 0 ? remainingBytes / speed : 0; // seconds

// Smooth display with moving average
if (timeDiff > 0.1) {  // Update every 100ms
  updateDisplay(speed, eta);
}
```

### Resumable Transfer State

```typescript
interface FileTransferState {
  fileId: string;
  fileName: string;
  chunks: ChunkState[];
  totalChunks: number;
  completedChunks: number;
  isPaused: boolean;
  isCompleted: boolean;
}

// Save to IndexedDB
await storageService.saveTransferState({
  sessionId: uuid(),
  files: fileStates,
  currentFileIndex: 0,
  totalFiles: files.length,
  isPaused: false,
  isCompleted: false,
  startTime: Date.now(),
  lastUpdateTime: Date.now()
});

// Resume from saved state
const savedState = await storageService.getTransferState(sessionId);
const startChunk = savedState.files[0].completedChunks;
// Continue from startChunk...
```

---

## Getting Started

### Prerequisites
- Node.js 16+ (for development)
- Modern web browser with:
  - WebRTC support (Chrome 90+, Firefox 88+, Safari 15+)
  - WebCrypto API support
  - IndexedDB support

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/swiftdrop.git
cd swiftdrop

# Install dependencies
npm install

# Build for production
npm run build
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Usage Guide

### Sending Files

1. **Open SwiftDrop** in your browser
2. **Click "Send Files"**
3. **Select Network Mode**:
   - **Internet**: Standard transfer via STUN servers (works anywhere)
   - **Local**: Optimized for same Wi-Fi network (faster)
4. **Add Files**:
   - Drag and drop files onto the upload zone
   - Or click to browse and select files
   - Remove individual files if needed
5. **Generate Code**:
   - Click "Generate Connection Code"
   - QR code and session code are displayed
6. **Share Connection**:
   - Show QR code to receiver
   - Or copy connection data and send via any messaging app
7. **Wait for Connection**:
   - Status shows "waiting for connection"
   - Receiver must paste/scan your code
8. **Start Transfer**:
   - Click "Start Transfer" when connected
   - Monitor progress, speed, and ETA
   - Use pause/resume as needed
9. **Complete**:
   - Files are saved to receiver's downloads
   - Transfer record saved to history

### Receiving Files

1. **Open SwiftDrop** in your browser
2. **Click "Receive Files"**
3. **Enter Connection Data**:
   - Paste the connection data from sender
   - Or scan QR code (mobile devices)
4. **Click "Connect and Receive"**:
   - Connection establishes automatically
   - Transfer starts immediately
5. **Monitor Progress**:
   - View real-time speed and ETA
   - Wait for transfer to complete
6. **Download**:
   - Files automatically download to your browser's download folder
   - Transfer record saved to history

### Viewing History

1. **Click "View Transfer History"** from home screen
2. **See all past transfers**:
   - Sent and received files
   - File names, sizes, timestamps
   - Transfer status (completed/failed)
3. **Sort by date**: Most recent transfers at the top

---

## Security Considerations

### Encryption
- **Algorithm**: AES-GCM (Authenticated Encryption with Associated Data)
- **Key Size**: 256 bits (extremely secure)
- **IV**: 96 bits, randomly generated per encryption
- **Authentication**: Built-in authentication tag prevents tampering

### Key Management
- **Generation**: Client-side using WebCrypto API (cryptographically secure)
- **Exchange**: Keys shared during WebRTC signaling (visible to user)
- **Storage**: Keys never stored permanently (only in memory during session)
- **Lifetime**: One key per session, discarded after transfer

### Data Protection
- **In Transit**: All data encrypted before sending, decrypted after receiving
- **At Rest**: No file data stored on servers or IndexedDB (only metadata)
- **Peer-to-Peer**: Direct connection between devices (no intermediary)

### Signaling Security
- **Manual Exchange**: Connection data manually copied/pasted by user
- **Visibility**: User can inspect all connection data
- **Production Note**: For automatic signaling, use secure WebSocket with TLS

---

## Limitations & Known Issues

### Current Limitations

1. **Manual Signaling**
   - Requires copy-paste of connection data
   - No automatic peer discovery
   - **Solution**: Implement WebSocket signaling server

2. **NAT Traversal**
   - Uses public STUN servers only
   - May fail on symmetric NATs or restrictive firewalls
   - **Solution**: Add TURN server for relay fallback

3. **Sequential File Transfer**
   - Files transferred one-by-one
   - No parallel transfer support
   - **Solution**: Implement concurrent DataChannels

4. **Browser Storage Limits**
   - IndexedDB subject to browser quotas (typically 50MB-10GB)
   - Resumable state may be cleared
   - **Solution**: Warn users about storage limits

5. **Browser Dependency**
   - Requires modern browser with WebRTC support
   - No support for older browsers
   - **Solution**: Progressive enhancement or fallback UI

### Future Enhancements

- [ ] Automatic WebSocket signaling server
- [ ] TURN server integration for better NAT traversal
- [ ] Parallel multi-file transfer
- [ ] Folder upload and download
- [ ] Transfer speed optimization with multiple channels
- [ ] Mobile app versions (React Native)
- [ ] Real-time chat during transfer
- [ ] File preview before download
- [ ] Compression support
- [ ] Bandwidth throttling

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Support 

For issues, questions, or suggestions:

- Open a GitHub Issue
- Email: iram.faiaz99@gmail.com

---

<div align="center">
  
**SwiftDrop** - Fast, secure, peer-to-peer file sharing made simple.

Made with ❤️ using React, WebRTC, and WebCrypto

</div>
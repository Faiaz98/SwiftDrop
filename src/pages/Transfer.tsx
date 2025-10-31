import { useState, useEffect, useRef } from 'react';
import { Send, Download, Wifi, WifiOff, History, Home } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import ConnectionCode from '../components/ConnectionCode';
import { WebRTCTransfer } from '../api/webrtc';
import { generateEncryptionKey, exportKey, importKey } from '../api/encryption';
import { storageService } from '../api/storage';
import { TransferProgress, TransferMode } from '../types/transfer';

type TransferStatus = 'idle' | 'waiting-connection' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'failed';

export default function Transfer() {
  const [mode, setMode] = useState<TransferMode>(null);
  const [status, setStatus] = useState<TransferStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<TransferProgress>({ sent: 0, total: 0, percentage: 0 });
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionData, setSessionData] = useState<string>('');
  const [receiverCode, setReceiverCode] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [showHistory, setShowHistory] = useState(false);
  
  const webrtcRef = useRef<WebRTCTransfer | null>(null);
  const encryptionKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.close();
      }
    };
  }, []);

  const generateSessionCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionCode(code);
    return code;
  };

  const handleSendMode = async () => {
    if (!selectedFile) return;

    try {
      setMode('sender');
      setStatus('connecting');
      
      // Initialize WebRTC
      const webrtc = new WebRTCTransfer();
      webrtcRef.current = webrtc;

      // Generate encryption key
      const key = await generateEncryptionKey();
      encryptionKeyRef.current = key;
      webrtc.setEncryptionKey(key);

      // Setup callbacks
      webrtc.onProgress((prog) => setProgress(prog));
      webrtc.onConnectionState((state) => {
        setConnectionState(state);
        if (state === 'connected') {
          setStatus('connected');
        } else if (state === 'failed') {
          setStatus('failed');
        }
      });

      // Create offer
      const offer = await webrtc.createOffer();
      const iceCandidates = await webrtc.getLocalIceCandidates();
      
      // Export encryption key
      const keyString = await exportKey(key);

      // Create session data
      const code = generateSessionCode();
      const data = {
        code,
        offer,
        iceCandidates,
        key: keyString,
      };

      setSessionData(JSON.stringify(data));
      setStatus('waiting-connection');
    } catch (error) {
      console.error('Error setting up sender:', error);
      setStatus('failed');
    }
  };

  const handleReceiveMode = async () => {
    if (!receiverCode) return;

    try {
      setMode('receiver');
      setStatus('connecting');

      // Parse session data
      const data = JSON.parse(receiverCode);
      
      // Initialize WebRTC
      const webrtc = new WebRTCTransfer();
      webrtcRef.current = webrtc;

      // Import encryption key
      const key = await importKey(data.key);
      encryptionKeyRef.current = key;
      webrtc.setEncryptionKey(key);

      // Setup callbacks
      webrtc.onProgress((prog) => setProgress(prog));
      webrtc.onFileReceived(async (file) => {
        setStatus('completed');
        
        // Save to history
        await storageService.addTransfer({
          id: uuidv4(),
          fileName: file.name,
          fileSize: file.size,
          timestamp: Date.now(),
          type: 'received',
          status: 'completed',
        });

        // Trigger download
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      });
      webrtc.onConnectionState((state) => {
        setConnectionState(state);
        if (state === 'connected') {
          setStatus('connected');
        } else if (state === 'failed') {
          setStatus('failed');
        }
      });

      // Handle offer and create answer
      const answer = await webrtc.handleOffer(data.offer);
      
      // Add ICE candidates
      for (const candidate of data.iceCandidates) {
        await webrtc.addIceCandidate(candidate);
      }

      // In a real app, you'd send the answer back to the sender
      // For this demo, we'll show the answer for manual exchange
      console.log('Answer:', answer);
      
      setStatus('connected');
    } catch (error) {
      console.error('Error setting up receiver:', error);
      setStatus('failed');
    }
  };

  const handleStartTransfer = async () => {
    if (!webrtcRef.current || !selectedFile) return;

    try {
      setStatus('transferring');
      await webrtcRef.current.sendFile(selectedFile);
      setStatus('completed');

      // Save to history
      await storageService.addTransfer({
        id: uuidv4(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        timestamp: Date.now(),
        type: 'sent',
        status: 'completed',
      });
    } catch (error) {
      console.error('Error transferring file:', error);
      setStatus('failed');
    }
  };

  const handleReset = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setMode(null);
    setStatus('idle');
    setSelectedFile(null);
    setProgress({ sent: 0, total: 0, percentage: 0 });
    setSessionCode('');
    setSessionData('');
    setReceiverCode('');
    setConnectionState('disconnected');
  };

  const renderConnectionStatus = () => {
    const isConnected = connectionState === 'connected';
    return (
      <div className="flex items-center gap-2 text-sm">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-400" />
        )}
        <span className={isConnected ? 'text-green-600' : 'text-gray-500'}>
          {connectionState}
        </span>
      </div>
    );
  };

  if (showHistory) {
    return <TransferHistory onBack={() => setShowHistory(false)} />;
  }

  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-800 mb-4">
              P2P File Transfer
            </h1>
            <p className="text-lg text-gray-600">
              Secure, encrypted peer-to-peer file sharing
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div
              onClick={() => setMode('sender')}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500 group"
            >
              <div className="flex justify-center mb-6">
                <div className="p-6 bg-blue-100 rounded-full group-hover:bg-blue-500 transition-colors duration-300">
                  <Send className="w-12 h-12 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">
                Send File
              </h2>
              <p className="text-gray-600 text-center">
                Share a file with another device securely
              </p>
            </div>

            <div
              onClick={() => setMode('receiver')}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-purple-500 group"
            >
              <div className="flex justify-center mb-6">
                <div className="p-6 bg-purple-100 rounded-full group-hover:bg-purple-500 transition-colors duration-300">
                  <Download className="w-12 h-12 text-purple-600 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">
                Receive File
              </h2>
              <p className="text-gray-600 text-center">
                Enter a code to receive a file from another device
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <History className="w-5 h-5" />
              View Transfer History
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'sender') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Send File</h1>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {status === 'idle' && (
            <div className="space-y-6">
              <FileDropZone
                onFileSelected={setSelectedFile}
                disabled={!!selectedFile}
              />

              {selectedFile && (
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Selected File
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    onClick={handleSendMode}
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    Generate Connection Code
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'waiting-connection' && sessionData && (
            <div className="flex justify-center">
              <ConnectionCode
                code={sessionCode}
                sessionData={sessionData}
                onClose={handleReset}
              />
            </div>
          )}

          {(status === 'connected' || status === 'transferring' || status === 'completed') && (
            <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Transfer Status</h2>
                {renderConnectionStatus()}
              </div>

              {selectedFile && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-800">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              {status === 'connected' && (
                <button
                  onClick={handleStartTransfer}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Start Transfer
                </button>
              )}

              {(status === 'transferring' || status === 'completed') && (
                <ProgressBar
                  progress={progress}
                  status={status === 'completed' ? 'completed' : 'transferring'}
                />
              )}

              {status === 'completed' && (
                <div className="text-center">
                  <p className="text-green-600 font-semibold mb-4">
                    Transfer completed successfully!
                  </p>
                  <button
                    onClick={handleReset}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                  >
                    New Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
              <p className="text-red-600 font-semibold mb-4">
                Connection failed. Please try again.
              </p>
              <button
                onClick={handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'receiver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Receive File</h1>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {status === 'idle' && (
            <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Connection Data
                </label>
                <textarea
                  value={receiverCode}
                  onChange={(e) => setReceiverCode(e.target.value)}
                  placeholder="Paste the connection data from sender..."
                  className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
                />
              </div>

              <button
                onClick={handleReceiveMode}
                disabled={!receiverCode}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Connect and Receive
              </button>
            </div>
          )}

          {(status === 'connecting' || status === 'connected' || status === 'transferring' || status === 'completed') && (
            <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Receiving File</h2>
                {renderConnectionStatus()}
              </div>

              {status === 'connecting' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Connecting to sender...</p>
                </div>
              )}

              {(status === 'transferring' || status === 'completed') && (
                <ProgressBar
                  progress={progress}
                  status={status === 'completed' ? 'completed' : 'transferring'}
                />
              )}

              {status === 'completed' && (
                <div className="text-center">
                  <p className="text-green-600 font-semibold mb-4">
                    File received and downloaded successfully!
                  </p>
                  <button
                    onClick={handleReset}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                  >
                    New Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
              <p className="text-red-600 font-semibold mb-4">
                Connection failed. Please check the code and try again.
              </p>
              <button
                onClick={handleReset}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// Transfer History Component
function TransferHistory({ onBack }: { onBack: () => void }) {
  const [transfers, setTransfers] = useState<any[]>([]);

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      const history = await storageService.getAllTransfers();
      setTransfers(history);
    } catch (error) {
      console.error('Error loading transfers:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Transfer History</h1>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            <Home className="w-5 h-5" />
            Back
          </button>
        </div>

        {transfers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No transfer history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {transfer.type === 'sent' ? (
                        <Send className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Download className="w-5 h-5 text-purple-500" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-800">
                        {transfer.fileName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{formatBytes(transfer.fileSize)}</span>
                      <span>•</span>
                      <span>{formatDate(transfer.timestamp)}</span>
                      <span>•</span>
                      <span className={`font-medium ${
                        transfer.status === 'completed' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transfer.status}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    transfer.type === 'sent' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {transfer.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

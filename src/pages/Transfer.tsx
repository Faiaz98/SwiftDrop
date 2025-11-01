import { useState, useEffect, useRef } from 'react';
import { Send, Download, Wifi, WifiOff, History, Home, Pause, Play, Share2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import ConnectionCode from '../components/ConnectionCode';
import { WebRTCTransfer } from '../api/webrtc';
import { generateEncryptionKey, exportKey, importKey } from '../api/encryption';
import { storageService } from '../api/storage';
import { TransferProgress, TransferMode, NetworkMode } from '../types/transfer';

type TransferStatus = 'idle' | 'waiting-connection' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'failed' | 'paused';

export default function Transfer() {
  const [mode, setMode] = useState<TransferMode>(null);
  const [status, setStatus] = useState<TransferStatus>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress>({ sent: 0, total: 0, percentage: 0 });
  const progressStartTimeRef = useRef<number>(0);
  const lastProgressUpdateRef = useRef<{sent: number, time: number}>({sent: 0, time: 0});
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionData, setSessionData] = useState<string>('');
  const [receiverCode, setReceiverCode] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [showHistory, setShowHistory] = useState(false);
  const [networkMode, setNetworkMode] = useState<NetworkMode>('internet');
  const [isPaused, setIsPaused] = useState(false);
  
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
    if (selectedFiles.length === 0) return;

    try {
      setMode('sender');
      setStatus('connecting');
      
      // Initialize WebRTC with network mode
      const webrtc = new WebRTCTransfer(networkMode === 'local');
      webrtcRef.current = webrtc;

      // Generate encryption key
      const key = await generateEncryptionKey();
      encryptionKeyRef.current = key;
      webrtc.setEncryptionKey(key);

      // Setup callbacks
      webrtc.onProgress((prog) => {
        const now = Date.now();
        if (!progressStartTimeRef.current) {
          progressStartTimeRef.current = now;
          lastProgressUpdateRef.current = {sent: prog.sent, time: now};
        }
        
        // Calculate speed and ETA
        const timeDiff = (now - lastProgressUpdateRef.current.time) / 1000; // seconds
        const bytesDiff = prog.sent - lastProgressUpdateRef.current.sent;
        
        let speed = 0;
        let eta = 0;
        
        if (timeDiff > 0.1) { // Update every 100ms
          speed = bytesDiff / timeDiff;
          const remaining = prog.total - prog.sent;
          eta = speed > 0 ? remaining / speed : 0;
          
          lastProgressUpdateRef.current = {sent: prog.sent, time: now};
        } else if (lastProgressUpdateRef.current.time > 0) {
          // Use previous calculation
          const totalTime = (now - progressStartTimeRef.current) / 1000;
          speed = totalTime > 0 ? prog.sent / totalTime : 0;
          const remaining = prog.total - prog.sent;
          eta = speed > 0 ? remaining / speed : 0;
        }
        
        setProgress({...prog, speed, eta, startTime: progressStartTimeRef.current});
      });
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
        isLocalNetwork: networkMode === 'local',
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
      const isLocalNetwork = data.isLocalNetwork || false;
      
      // Initialize WebRTC
      const webrtc = new WebRTCTransfer(isLocalNetwork);
      webrtcRef.current = webrtc;

      // Import encryption key
      const key = await importKey(data.key);
      encryptionKeyRef.current = key;
      webrtc.setEncryptionKey(key);

      // Setup callbacks
      webrtc.onProgress((prog) => {
        const now = Date.now();
        if (!progressStartTimeRef.current) {
          progressStartTimeRef.current = now;
          lastProgressUpdateRef.current = {sent: prog.sent, time: now};
        }
        
        // Calculate speed and ETA for receiver
        const timeDiff = (now - lastProgressUpdateRef.current.time) / 1000;
        const bytesDiff = prog.sent - lastProgressUpdateRef.current.sent;
        
        let speed = 0;
        let eta = 0;
        
        if (timeDiff > 0.1) {
          speed = bytesDiff / timeDiff;
          const remaining = prog.total - prog.sent;
          eta = speed > 0 ? remaining / speed : 0;
          lastProgressUpdateRef.current = {sent: prog.sent, time: now};
        } else if (lastProgressUpdateRef.current.time > 0) {
          const totalTime = (now - progressStartTimeRef.current) / 1000;
          speed = totalTime > 0 ? prog.sent / totalTime : 0;
          const remaining = prog.total - prog.sent;
          eta = speed > 0 ? remaining / speed : 0;
        }
        
        setProgress({...prog, speed, eta, startTime: progressStartTimeRef.current});
      });
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

      setStatus('connected');
    } catch (error) {
      console.error('Error setting up receiver:', error);
      setStatus('failed');
    }
  };

  const handleStartTransfer = async () => {
    if (!webrtcRef.current || selectedFiles.length === 0) return;

    try {
      setStatus('transferring');
      progressStartTimeRef.current = Date.now();
      lastProgressUpdateRef.current = {sent: 0, time: Date.now()};
      await webrtcRef.current.sendFiles(selectedFiles);
      setStatus('completed');

      // Save to history
      for (const file of selectedFiles) {
        await storageService.addTransfer({
          id: uuidv4(),
          fileName: file.name,
          fileSize: file.size,
          timestamp: Date.now(),
          type: 'sent',
          status: 'completed',
        });
      }
    } catch (error) {
      console.error('Error transferring files:', error);
      setStatus('failed');
    }
  };

  const handlePauseResume = () => {
    if (!webrtcRef.current) return;

    if (isPaused) {
      webrtcRef.current.resumeTransfer();
      webrtcRef.current.sendResumeSignal();
      setIsPaused(false);
      setStatus('transferring');
    } else {
      webrtcRef.current.pauseTransfer();
      webrtcRef.current.sendPauseSignal();
      setIsPaused(true);
      setStatus('paused');
    }
  };

  const handleReset = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setMode(null);
    setStatus('idle');
    setSelectedFiles([]);
    setProgress({ sent: 0, total: 0, percentage: 0 });
    setSessionCode('');
    setSessionData('');
    setReceiverCode('');
    setConnectionState('disconnected');
    setIsPaused(false);
    progressStartTimeRef.current = 0;
    lastProgressUpdateRef.current = {sent: 0, time: 0};
  };

  const renderConnectionStatus = () => {
    const isConnected = connectionState === 'connected';
    return (
      <div className="flex items-center gap-2 text-sm">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-teal-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-400" />
        )}
        <span className={isConnected ? 'text-teal-600' : 'text-gray-500'}>
          {connectionState}
        </span>
        {networkMode === 'local' && isConnected && (
          <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-lg flex items-center gap-1 font-medium">
            <Share2 className="w-3 h-3" />
            Local
          </span>
        )}
      </div>
    );
  };

  if (showHistory) {
    return <TransferHistory onBack={() => setShowHistory(false)} />;
  }

  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-4 mb-6">
              {/* Modern geometric logo */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center transform rotate-45">
                  <Share2 className="w-8 h-8 text-white transform -rotate-45" strokeWidth={2.5} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg"></div>
              </div>
              <div className="text-left">
                <h1 className="text-6xl font-bold text-gray-900 tracking-tight">
                  SwiftDrop
                </h1>
                <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">P2P File Transfer</p>
              </div>
            </div>
            <p className="text-lg text-gray-600 font-light">
              Secure, encrypted peer-to-peer file sharing
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div
              onClick={() => setMode('sender')}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg border border-gray-100 hover:border-teal-200 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex justify-center mb-6">
                <div className="p-5 bg-gray-50 group-hover:bg-teal-50 rounded-2xl transition-colors duration-300">
                  <Send className="w-10 h-10 text-gray-700 group-hover:text-teal-600 transition-colors duration-300" strokeWidth={2} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                Send Files
              </h2>
              <p className="text-gray-500 text-center font-light">
                Share files with another device securely
              </p>
            </div>

            <div
              onClick={() => setMode('receiver')}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg border border-gray-100 hover:border-teal-200 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex justify-center mb-6">
                <div className="p-5 bg-gray-50 group-hover:bg-teal-50 rounded-2xl transition-colors duration-300">
                  <Download className="w-10 h-10 text-gray-700 group-hover:text-teal-600 transition-colors duration-300" strokeWidth={2} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                Receive Files
              </h2>
              <p className="text-gray-500 text-center font-light">
                Enter a code to receive files from another device
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center transform rotate-45">
                <Share2 className="w-6 h-6 text-white transform -rotate-45" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  SwiftDrop
                </h1>
                <p className="text-sm text-gray-500 font-medium">Send Files</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {status === 'idle' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700">Network Mode</label>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => setNetworkMode('internet')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        networkMode === 'internet'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Wifi className="w-4 h-4 inline mr-1" />
                      Internet
                    </button>
                    <button
                      onClick={() => setNetworkMode('local')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        networkMode === 'local'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Share2 className="w-4 h-4 inline mr-1" />
                      Local
                    </button>
                  </div>
                </div>
                {networkMode === 'local' && (
                  <p className="text-xs text-gray-500 bg-teal-50 p-2 rounded-lg">
                    Local network mode prioritizes same Wi-Fi connections for faster transfers
                  </p>
                )}
              </div>

              <FileDropZone
                onFilesSelected={setSelectedFiles}
                selectedFiles={selectedFiles}
                disabled={selectedFiles.length > 0 && status !== 'idle'}
                multiple={true}
              />

              {selectedFiles.length > 0 && (
                <button
                  onClick={handleSendMode}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
                >
                  Generate Connection Code
                </button>
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

          {(status === 'connected' || status === 'transferring' || status === 'paused' || status === 'completed') && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Transfer Status</h2>
                {renderConnectionStatus()}
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {status === 'connected' && (
                <button
                  onClick={handleStartTransfer}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
                >
                  Start Transfer
                </button>
              )}

              {(status === 'transferring' || status === 'paused' || status === 'completed') && (
                <>
                  <ProgressBar
                    progress={progress}
                    status={status === 'completed' ? 'completed' : status === 'paused' ? 'transferring' : 'transferring'}
                  />

                  {(status === 'transferring' || status === 'paused') && (
                    <button
                      onClick={handlePauseResume}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-5 h-5" />
                          Resume Transfer
                        </>
                      ) : (
                        <>
                          <Pause className="w-5 h-5" />
                          Pause Transfer
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {status === 'completed' && (
                <div className="text-center">
                  <p className="text-teal-600 font-semibold mb-4">
                    Transfer completed successfully!
                  </p>
                  <button
                    onClick={handleReset}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors duration-200"
                  >
                    New Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-100 text-center">
              <p className="text-red-600 font-semibold mb-4">
                Connection failed. Please try again.
              </p>
              <button
                onClick={handleReset}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors duration-200"
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center transform rotate-45">
                <Share2 className="w-6 h-6 text-white transform -rotate-45" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  SwiftDrop
                </h1>
                <p className="text-sm text-gray-500 font-medium">Receive Files</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {status === 'idle' && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Connection Data
                </label>
                <textarea
                  value={receiverCode}
                  onChange={(e) => setReceiverCode(e.target.value)}
                  placeholder="Paste the connection data from sender..."
                  className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200 font-mono text-sm"
                />
              </div>

              <button
                onClick={handleReceiveMode}
                disabled={!receiverCode}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
              >
                Connect and Receive
              </button>
            </div>
          )}

          {(status === 'connecting' || status === 'connected' || status === 'transferring' || status === 'paused' || status === 'completed') && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Receiving Files</h2>
                {renderConnectionStatus()}
              </div>

              {status === 'connecting' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Connecting to sender...</p>
                </div>
              )}

              {(status === 'transferring' || status === 'paused' || status === 'completed') && (
                <ProgressBar
                  progress={progress}
                  status={status === 'completed' ? 'completed' : status === 'paused' ? 'transferring' : 'transferring'}
                />
              )}

              {status === 'paused' && (
                <div className="text-center">
                  <p className="text-yellow-600 font-medium">
                    Transfer paused by sender
                  </p>
                </div>
              )}

              {status === 'completed' && (
                <div className="text-center">
                  <p className="text-teal-600 font-semibold mb-4">
                    File received and downloaded successfully!
                  </p>
                  <button
                    onClick={handleReset}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors duration-200"
                  >
                    New Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-100 text-center">
              <p className="text-red-600 font-semibold mb-4">
                Connection failed. Please check the code and try again.
              </p>
              <button
                onClick={handleReset}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors duration-200"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center transform rotate-45">
              <Share2 className="w-6 h-6 text-white transform -rotate-45" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                SwiftDrop
              </h1>
              <p className="text-sm text-gray-500 font-medium">Transfer History</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <Home className="w-5 h-5" />
            Back
          </button>
        </div>

        {transfers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No transfer history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {transfer.type === 'sent' ? (
                        <Send className="w-5 h-5 text-teal-500" />
                      ) : (
                        <Download className="w-5 h-5 text-cyan-500" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {transfer.fileName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 font-light">
                      <span>{formatBytes(transfer.fileSize)}</span>
                      <span>•</span>
                      <span>{formatDate(transfer.timestamp)}</span>
                      <span>•</span>
                      <span className={`font-medium ${
                        transfer.status === 'completed' ? 'text-teal-600' : 'text-red-600'
                      }`}>
                        {transfer.status}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    transfer.type === 'sent' 
                      ? 'bg-teal-50 text-teal-700' 
                      : 'bg-cyan-50 text-cyan-700'
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

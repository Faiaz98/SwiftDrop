import { TransferProgress } from '../types/transfer';
import { Clock, Share2 } from 'lucide-react';

interface ProgressBarProps {
  progress: TransferProgress;
  status: 'transferring' | 'completed' | 'failed';
}

export default function ProgressBar({ progress, status }: ProgressBarProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return `${(bytesPerSecond / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatETA = (seconds: number) => {
    if (!seconds || seconds === Infinity || isNaN(seconds)) return 'Calculating...';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'transferring':
        return 'bg-teal-500';
      case 'completed':
        return 'bg-teal-600';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'transferring':
        return 'Transferring...';
      case 'completed':
        return 'Transfer completed!';
      case 'failed':
        return 'Transfer failed';
      default:
        return '';
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          {getStatusText()}
        </span>
        <span className="text-sm text-gray-500">
          {formatBytes(progress.sent)} / {formatBytes(progress.total)}
        </span>
      </div>
      
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${getStatusColor()}`}
          style={{ width: `${progress.percentage}%` }}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-gray-800">
            {progress.percentage}%
          </span>
          
          {status === 'transferring' && progress.speed !== undefined && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-teal-600">
                <Share2 className="w-4 h-4" />
                <span className="font-semibold">{formatSpeed(progress.speed)}</span>
              </div>
              
              {progress.eta !== undefined && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{formatETA(progress.eta)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { TransferProgress } from '../types/transfer';

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

  const getStatusColor = () => {
    switch (status) {
      case 'transferring':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
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
      
      <div className="flex justify-center mt-2">
        <span className="text-2xl font-bold text-gray-800">
          {progress.percentage}%
        </span>
      </div>
    </div>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ConnectionCodeProps {
  code: string;
  sessionData: string;
  onClose?: () => void;
}

export default function ConnectionCode({ code, sessionData, onClose }: ConnectionCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sessionData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Share this code
      </h2>
      
      <div className="flex justify-center mb-6">
        <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
          <QRCodeSVG value={sessionData} size={200} />
        </div>
      </div>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2 text-center">Session Code</p>
        <div className="bg-gray-100 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-gray-800 tracking-wider">
            {code}
          </p>
        </div>
      </div>
      
      <div className="space-y-3">
        <button
          onClick={handleCopy}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy Connection Data
            </>
          )}
        </button>
        
        {onClose && (
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-4 text-center">
        Share this code with the receiver to establish a secure connection
      </p>
    </div>
  );
}

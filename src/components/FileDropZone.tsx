import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function FileDropZone({ onFileSelected, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelected(files[0]);
    }
  }, [disabled, onFileSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  }, [onFileSelected]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-105' 
          : 'border-gray-300 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !disabled && document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={`
          p-4 rounded-full transition-colors duration-300
          ${isDragging ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}
        `}>
          <Upload className="w-12 h-12" />
        </div>
        
        <div>
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Drop your file here
          </p>
          <p className="text-sm text-gray-500">
            or click to browse
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import { Upload, ImagePlus } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset value so same files can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (fileList: FileList) => {
    const validFiles: File[] = [];
    Array.from(fileList).forEach((file) => {
      if (file.type.startsWith('image/')) {
        validFiles.push(file);
      }
    });
    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group
        ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-gray-700 bg-gray-900/50 hover:border-indigo-400 hover:bg-gray-800'
        }
      `}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        ref={fileInputRef}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-4 text-center p-6">
        <div className={`p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white'}`}>
          {isDragging ? <ImagePlus size={40} /> : <Upload size={40} />}
        </div>
        <div className="space-y-2">
          <p className="text-xl font-semibold text-gray-200">
            {isDragging ? 'Solte as imagens aqui' : 'Arraste e solte imagens aqui'}
          </p>
          <p className="text-sm text-gray-400">
            ou clique para selecionar arquivos (JPG, PNG, GIF...)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dropzone;
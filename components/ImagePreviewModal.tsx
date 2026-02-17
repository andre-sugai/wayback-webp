import React, { useEffect, useCallback, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, SplitSquareHorizontal, Download } from 'lucide-react';
import { ProcessedImage } from '../types';
import { formatBytes, downloadBlob } from '../utils/imageUtils';

interface ImagePreviewModalProps {
  isOpen: boolean;
  item: ProcessedImage;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  outputFormat: 'webp' | 'original';
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  item,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  outputFormat
}) => {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate URL for output blob when available
  useEffect(() => {
    if (item.outputBlob) {
      const url = URL.createObjectURL(item.outputBlob);
      setProcessedUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setProcessedUrl(null);
    }
  }, [item.outputBlob, item.id]);

  // Reset slider when image changes
  useEffect(() => {
    setSliderPosition(50);
  }, [item.id]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && hasNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev) onPrev();
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    // Calculate position
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsResizing(true);
  const handleMouseUp = () => setIsResizing(false);

  // Allow dragging anywhere if isResizing is true
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isResizing && containerRef.current) {
        // Adapt logic from handleMouseMove for global context
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;
        setSliderPosition(percentage);
      }
    };

    const handleGlobalUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchmove', handleGlobalMove);
      window.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isResizing]);


  if (!isOpen) return null;

  const showComparison = processedUrl && item.status === 'done';
  const fileExtension = outputFormat === 'webp' ? 'webp' : item.originalExtension;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex flex-col">
          <span className="text-gray-200 font-medium truncate max-w-md px-2 drop-shadow-md">
            {item.name}
          </span>
          {showComparison && (
            <div className="flex items-center gap-2 px-2 text-xs text-gray-400">
               <SplitSquareHorizontal size={14} />
               <span>Modo Comparação</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 pointer-events-auto">
          {item.outputBlob && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadBlob(item.outputBlob!, item.name, fileExtension);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-indigo-600 text-white transition-all backdrop-blur-md"
              title="Baixar Resultado"
            >
              <Download size={20} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Navigation Buttons */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 p-3 rounded-full bg-white/5 hover:bg-white/20 text-white transition-all backdrop-blur-md z-50 group border border-white/10"
        >
          <ChevronLeft size={32} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Main Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {showComparison ? (
          /* COMPARISON MODE */
          <div 
            ref={containerRef}
            className="relative max-w-full max-h-[85vh] select-none shadow-2xl overflow-hidden rounded-lg group cursor-col-resize"
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            // Add a mouse move listener here for immediate feedback without clicking (hover effect style)
            // or stick to drag only. Drag is better for precision.
          >
            {/* 1. Base Image (Original) - Determines Container Size */}
            {/* Note: We use the original as the base because resizing might change dimensions, 
                but usually we want to compare against the source layout. 
                If resizing changed aspect ratio, this simple overlay wouldn't work, 
                but our resizer keeps aspect ratio. */}
            <img
              src={item.previewUrl}
              alt="Original"
              className="block max-w-full max-h-[85vh] object-contain pointer-events-none"
              draggable={false}
            />

            {/* 2. Processed Image (Overlay) - Clipped */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
            >
              <img
                src={processedUrl!}
                alt="Processed"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              {/* Processed Label */}
              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-emerald-400 text-xs font-bold px-3 py-1.5 rounded border border-emerald-500/30 flex flex-col items-end">
                <span>DEPOIS</span>
                <span className="text-gray-300 font-mono font-normal">{formatBytes(item.sizeOutput)}</span>
              </div>
            </div>

            {/* 3. Original Label (Visible on the left side) */}
            <div 
              className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-indigo-400 text-xs font-bold px-3 py-1.5 rounded border border-indigo-500/30 flex flex-col items-start transition-opacity"
              style={{ opacity: sliderPosition > 10 ? 1 : 0 }} // Hide if slider covers it
            >
               <span>ANTES</span>
               <span className="text-gray-300 font-mono font-normal">{formatBytes(item.sizeOriginal)}</span>
            </div>

            {/* 4. Slider Handle Line */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                <SplitSquareHorizontal size={16} className="text-gray-900" />
              </div>
            </div>
          </div>
        ) : (
          /* SINGLE IMAGE MODE */
          <div className="relative">
            <img
              src={item.previewUrl}
              alt={item.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-gray-200 text-xs px-3 py-1.5 rounded-full border border-gray-700">
              Original: {formatBytes(item.sizeOriginal)}
            </div>
          </div>
        )}
      </div>

      {/* Right Navigation */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 p-3 rounded-full bg-white/5 hover:bg-white/20 text-white transition-all backdrop-blur-md z-50 group border border-white/10"
        >
          <ChevronRight size={32} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
      
      {/* Footer Hint */}
      <div className="absolute bottom-6 text-white/40 text-xs font-mono select-none pointer-events-none">
        {showComparison 
          ? "Arraste a barra para comparar • Setas para navegar" 
          : "Setas para navegar • ESC para fechar"
        }
      </div>
    </div>
  );
};

export default ImagePreviewModal;
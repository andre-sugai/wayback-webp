import React from 'react';
import { X, Download, FileImage, Loader2, CheckCircle, AlertCircle, GripVertical, MoveRight, Ruler, ChevronUp, ChevronDown, ZoomIn } from 'lucide-react';
import { ProcessedImage } from '../types';
import { formatBytes, downloadBlob } from '../utils/imageUtils';

interface ImageItemProps {
  item: ProcessedImage;
  outputFormat: 'webp' | 'original';
  resizeScale?: number;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onPreview: (id: string) => void;
  // Dnd Kit props passed down
  dragHandleProps?: any;
  isDragging?: boolean;
  // Manual reordering props
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const ImageItem: React.FC<ImageItemProps> = ({ 
  item, 
  outputFormat, 
  resizeScale = 1,
  onRemove, 
  onRename,
  onPreview,
  dragHandleProps,
  isDragging,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}) => {
  const fileExtension = outputFormat === 'webp' ? 'webp' : item.originalExtension;

  const handleDownload = () => {
    if (item.outputBlob) {
      downloadBlob(item.outputBlob, item.name, fileExtension);
    }
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case 'processing':
        return <Loader2 size={18} className="animate-spin text-indigo-400" />;
      case 'done':
        return <CheckCircle size={18} className="text-emerald-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
      default:
        return <FileImage size={18} className="text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    if (isDragging) return 'border-indigo-500/50 bg-indigo-500/20 shadow-xl scale-[1.02] z-50';
    
    switch (item.status) {
      case 'done': return 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      case 'processing': return 'border-indigo-500/30 bg-indigo-500/5';
      default: return 'border-gray-700 bg-gray-800/50 hover:border-gray-600';
    }
  };

  // Calculate final dimensions
  const finalWidth = Math.max(1, Math.floor(item.width * resizeScale));
  const finalHeight = Math.max(1, Math.floor(item.height * resizeScale));
  
  // Show scaling arrow if scale is not 1, regardless of format
  const hasScaling = resizeScale !== 1;

  return (
    <div className={`relative flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border ${getStatusColor()} transition-all duration-200 select-none`}>
      
      {/* Control Column: Manual Order + Grip */}
      <div className="hidden sm:flex flex-col items-center justify-center gap-0.5 pr-2 border-r border-gray-800 mr-2">
         <button 
           onClick={onMoveUp} 
           disabled={isFirst} 
           className="p-1 hover:bg-gray-800 rounded text-gray-600 hover:text-indigo-400 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors"
           title="Mover para cima"
         >
            <ChevronUp size={16} />
         </button>
         
         {/* Original Side Grip */}
         <div 
            {...dragHandleProps}
            style={{ touchAction: 'none' }}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-600 hover:text-gray-300 transition-colors"
            title="Arraste para reordenar"
         >
            <GripVertical size={20} />
         </div>

         <button 
           onClick={onMoveDown} 
           disabled={isLast} 
           className="p-1 hover:bg-gray-800 rounded text-gray-600 hover:text-indigo-400 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors"
           title="Mover para baixo"
         >
            <ChevronDown size={16} />
         </button>
      </div>

      {/* Preview */}
      <div 
        className="relative w-full sm:w-28 h-32 sm:h-24 shrink-0 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 group cursor-zoom-in"
        onClick={() => onPreview(item.id)}
        title="Clique para ampliar"
      >
        <img 
          src={item.previewUrl} 
          alt="Preview" 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
          draggable={false}
        />
        
        {/* Hover Overlay with Zoom Icon */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
           <ZoomIn size={24} className="text-white drop-shadow-md" />
        </div>

        {/* Status Icon Overlay (Corner) */}
        <div className="absolute top-1 left-1 pointer-events-none">
           {item.status === 'done' || item.status === 'error' ? (
              <div className="bg-gray-900/60 p-1 rounded-full backdrop-blur-sm">
                {getStatusIcon()}
              </div>
           ) : item.status === 'processing' && (
              <div className="bg-gray-900/60 p-1 rounded-full backdrop-blur-sm">
                 {getStatusIcon()}
              </div>
           )}
        </div>
        
        {/* Mobile: Grip Indicator (Since side column is hidden on mobile) */}
        <div 
          className="sm:hidden absolute top-2 right-2 p-1.5 bg-black/60 rounded text-white cursor-grab active:cursor-grabbing z-10"
          {...dragHandleProps} // Enable drag on this icon for mobile
          onClick={(e) => e.stopPropagation()} // Prevent preview click when dragging
          style={{ touchAction: 'none' }}
        >
           <GripVertical size={16} />
        </div>
      </div>

      {/* Info & Inputs */}
      <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Nome do arquivo</label>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onRename(item.id, e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600"
            placeholder="Nome do arquivo"
          />
          <span className="text-gray-500 text-sm font-medium select-none w-12">.{fileExtension}</span>
        </div>

        {/* Details Row: Size & Dimensions */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs mt-1">
          {/* File Size & Format */}
          <div className="flex items-center gap-4 text-gray-400">
            {item.originalExtension && (
               <span className="text-[10px] font-mono uppercase bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-400 tracking-wide select-none">
                 {item.originalExtension}
               </span>
            )}

            <span className="flex items-center gap-1">
              Original: <span className="text-gray-300">{formatBytes(item.sizeOriginal)}</span>
            </span>
            
            {item.outputBlob && (
              <>
                <span className="flex items-center gap-1">
                  {outputFormat === 'webp' ? 'WebP:' : 'Saída:'} <span className={outputFormat === 'webp' ? "text-emerald-400 font-medium" : "text-gray-300 font-medium"}>{formatBytes(item.sizeOutput)}</span>
                </span>
                {item.sizeOutput < item.sizeOriginal && (
                  <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px]">
                    -{Math.round(((item.sizeOriginal - item.sizeOutput) / item.sizeOriginal) * 100)}%
                  </span>
                )}
                 {item.sizeOutput > item.sizeOriginal && (
                  <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded text-[10px]">
                    +{Math.round(((item.sizeOutput - item.sizeOriginal) / item.sizeOriginal) * 100)}%
                  </span>
                )}
              </>
            )}
          </div>

          {/* Dimensions */}
          {item.width > 0 && (
             <div className="flex items-center gap-2 text-gray-400 border-l border-gray-700 pl-4">
                <Ruler size={12} className={hasScaling ? 'text-blue-400' : 'text-gray-500'} />
                
                {hasScaling ? (
                    <div className="flex items-center gap-2">
                         <span className="text-gray-400">{item.width}x{item.height}</span>
                         <MoveRight size={12} className="text-blue-500" />
                         <span className="text-blue-400 font-medium">{finalWidth}x{finalHeight}</span>
                    </div>
                ) : (
                    <span className="text-gray-400">{item.width}x{item.height} px</span>
                )}
             </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full sm:w-auto sm:flex-col gap-2 sm:ml-2">
        
        {/* Mobile: Up/Down Arrows */}
        <div className="sm:hidden flex flex-1 gap-1">
           <button 
             onClick={onMoveUp} 
             disabled={isFirst}
             className="flex-1 flex justify-center items-center p-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-25"
           >
              <ChevronUp size={16} />
           </button>
           <button 
             onClick={onMoveDown} 
             disabled={isLast}
             className="flex-1 flex justify-center items-center p-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-25"
           >
              <ChevronDown size={16} />
           </button>
        </div>

        <button
          onClick={handleDownload}
          disabled={item.status !== 'done'}
          className="flex-1 sm:flex-none flex justify-center items-center p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Baixar imagem"
        >
          <Download size={18} />
          <span className="sm:hidden ml-2 text-sm">Baixar</span>
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="flex-1 sm:flex-none flex justify-center items-center p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition-all"
          title="Remover"
        >
          <X size={18} />
          <span className="sm:hidden ml-2 text-sm">Remover</span>
        </button>
      </div>
    </div>
  );
};

export default ImageItem;
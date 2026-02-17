import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  Trash2, Download, Zap, Images, Settings2, 
  Type, Hash, MonitorPlay, Loader2, ArrowUp, History, Scaling, Gauge 
} from 'lucide-react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { ProcessedImage } from './types';
import { processImage, getImageDimensions, formatBytes } from './utils/imageUtils';
import Dropzone from './components/Dropzone';
import ImageItem from './components/ImageItem';
import Starfield from './components/Starfield';
import WaybackMachine from './components/WaybackMachine';
import ImagePreviewModal from './components/ImagePreviewModal';

// Sortable Wrapper Component
const SortableImageItem = ({ id, ...props }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ImageItem 
        {...props} 
        isDragging={isDragging} 
        dragHandleProps={{...attributes, ...listeners}} 
      />
    </div>
  );
};

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'converter' | 'wayback'>('converter');

  const [outputFormat, setOutputFormat] = useState<'webp' | 'original'>('webp');
  const [resizeScale, setResizeScale] = useState<number>(1);
  const [quality, setQuality] = useState<number>(0.8); // 0.1 to 1.0
  const [files, setFiles] = useState<ProcessedImage[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Preview Modal State
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Scroll Anchor Ref
  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll To Top State
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Bulk Rename State
  const [bulkName, setBulkName] = useState('');
  const [withNumbering, setWithNumbering] = useState(true);

  // Dnd Sensors - Switched to PointerSensor for better unified support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requires 8px movement to start drag, prevents accidental clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to apply naming pattern to a specific list
  const applyNamingPattern = useCallback((currentFiles: ProcessedImage[], baseName: string, numbering: boolean): ProcessedImage[] => {
    if (!baseName) return currentFiles;

    return currentFiles.map((file, index) => ({
      ...file,
      name: numbering ? `${baseName}${index + 1}` : baseName
    }));
  }, []);

  // Effect: Scroll Listener for Back To Top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Effect: Process Queue (Conversion or Pass-through)
  useEffect(() => {
    const processQueue = async () => {
      // Find files that need processing
      
      const pendingFiles = files.filter(f => f.status === 'pending');
      
      if (pendingFiles.length === 0) return;

      const newFiles = [...files];

      await Promise.all(pendingFiles.map(async (item) => {
        // Mark as processing
        const idx = newFiles.findIndex(f => f.id === item.id);
        if (idx !== -1) newFiles[idx].status = 'processing';
        setFiles([...newFiles]);

        try {
          let outputBlob: Blob;
          
          if (outputFormat === 'original' && resizeScale === 1 && quality >= 0.99) {
             // Pass-through optimization: No processing needed if format is original, scale is 1 AND quality is max
             // NOTE: If quality is lower, we allow processing even for original to apply compression
             outputBlob = item.originalFile;
             // Small delay for UX simulation so user sees 'processing' briefly if batch is large
             await new Promise(r => setTimeout(r, 50));
          } else {
             // Process: Convert to WebP OR Resize/Compress Original using Canvas
             outputBlob = await processImage(item.originalFile, resizeScale, outputFormat, quality);
          }
          
          // Update success
          const successIdx = newFiles.findIndex(f => f.id === item.id);
          if (successIdx !== -1) {
            newFiles[successIdx] = {
              ...newFiles[successIdx],
              status: 'done',
              outputBlob: outputBlob,
              sizeOutput: outputBlob.size
            };
          }
        } catch (error) {
          console.error("Error processing file", item.name, error);
          const errorIdx = newFiles.findIndex(f => f.id === item.id);
          if (errorIdx !== -1) {
            newFiles[errorIdx].status = 'error';
          }
        }
      }));

      setFiles([...newFiles]);
    };

    processQueue();
  }, [files, outputFormat, resizeScale, quality]);

  // Handle Format Toggle
  const handleFormatChange = (newFormat: 'webp' | 'original') => {
    if (newFormat === outputFormat) return;
    
    setOutputFormat(newFormat);
    
    // Reset status of all files to pending so they get re-processed/converted
    setFiles(prev => prev.map(f => ({
      ...f,
      status: 'pending',
      outputBlob: null,
      sizeOutput: 0
    })));
  };

  // Handle Resize Toggle
  const handleResizeChange = (scale: number) => {
    if (scale === resizeScale) return;
    
    setResizeScale(scale);
    
    // Re-process all files
    setFiles(prev => prev.map(f => ({
      ...f,
      status: 'pending',
      outputBlob: null,
      sizeOutput: 0
    })));
  };

  // Handle Quality Change
  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const newQuality = parseFloat(e.target.value);
     setQuality(newQuality);
     // Re-process is debounced by the user dragging, but here we just trigger simple re-process on change
     // Ideally onMouseUp for heavy loads, but for local canvas it's usually fine
  };

  const handleQualityCommit = () => {
    // Trigger reprocessing when user lets go of slider
    setFiles(prev => prev.map(f => ({
      ...f,
      status: 'pending',
      outputBlob: null,
      sizeOutput: 0
    })));
  };

  // Handle Bulk Input Changes
  const handleBulkNameChange = (text: string) => {
    setBulkName(text);
    if (text) {
      setFiles(prev => applyNamingPattern(prev, text, withNumbering));
    }
  };

  const handleNumberingToggle = (checked: boolean) => {
    setWithNumbering(checked);
    if (bulkName) {
      setFiles(prev => applyNamingPattern(prev, bulkName, checked));
    }
  };

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    // Intelligent Mode Switch:
    // If all uploaded files are WebP, automatically switch to 'original' mode
    // to prevent redundant conversion.
    const areAllWebP = newFiles.every(f => 
      f.type === 'image/webp' || f.name.toLowerCase().endsWith('.webp')
    );

    let switchingToOriginal = false;

    if (areAllWebP && outputFormat === 'webp') {
        setOutputFormat('original');
        switchingToOriginal = true;
    }

    const startIndex = files.length;

    const processedInit = await Promise.all(newFiles.map(async (file, i) => {
      const lastDotIndex = file.name.lastIndexOf('.');
      const originalName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex + 1) : '';

      // Apply bulk name if exists
      let finalName = originalName;
      if (bulkName) {
         finalName = withNumbering ? `${bulkName}${startIndex + i + 1}` : bulkName;
      }

      // Get Dimensions
      const { width, height } = await getImageDimensions(file);

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        previewUrl: URL.createObjectURL(file),
        name: finalName,
        originalExtension: ext,
        status: 'pending' as const,
        outputBlob: null,
        sizeOriginal: file.size,
        sizeOutput: 0,
        width,
        height
      };
    }));

    setFiles(prev => {
        let previousFiles = prev;

        // If we automatically switched mode, we must reset existing files to pending
        // so they are re-evaluated under the new "Original" mode.
        if (switchingToOriginal) {
            previousFiles = prev.map(f => ({
                ...f,
                status: 'pending',
                outputBlob: null,
                sizeOutput: 0
            }));
        }

        return [...previousFiles, ...processedInit];
    });

    // Smooth scroll to the results section after a short delay to allow render
    setTimeout(() => {
      if (resultsRef.current) {
        // Calculate offset to account for sticky header (approx 100px)
        const yOffset = -100;
        const element = resultsRef.current;
        const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
        
        window.scrollTo({
          top: y,
          behavior: 'smooth'
        });
      }
    }, 150);

  }, [files.length, bulkName, withNumbering, outputFormat]);

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
       if (activeTab !== 'converter') return;
       
       if (e.clipboardData && e.clipboardData.files.length > 0) {
         const pastedFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
         if (pastedFiles.length > 0) {
           handleFilesAdded(pastedFiles);
         }
       }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesAdded, activeTab]);

  // Drag End Handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Re-apply naming pattern if active
        if (bulkName) {
            return applyNamingPattern(newOrder, bulkName, withNumbering);
        }

        return newOrder;
      });
    }
  };

  // Manual Move Handlers
  const handleMoveUp = (id: string) => {
    setFiles(prev => {
      const index = prev.findIndex(f => f.id === id);
      if (index <= 0) return prev;
      
      const newFiles = arrayMove(prev, index, index - 1);
      if (bulkName) return applyNamingPattern(newFiles, bulkName, withNumbering);
      return newFiles;
    });
  };

  const handleMoveDown = (id: string) => {
    setFiles(prev => {
      const index = prev.findIndex(f => f.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      
      const newFiles = arrayMove(prev, index, index + 1);
      if (bulkName) return applyNamingPattern(newFiles, bulkName, withNumbering);
      return newFiles;
    });
  };

  const handleRemove = (id: string) => {
    setFiles(prev => {
      const remaining = prev.filter(f => f.id !== id);
      const target = prev.find(f => f.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      
      // Re-index if bulk rename is active
      if (bulkName && withNumbering) {
         return applyNamingPattern(remaining, bulkName, withNumbering);
      }
      
      return remaining;
    });
  };

  const handleRename = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  // Preview Handlers
  const handleOpenPreview = (id: string) => {
    const index = files.findIndex(f => f.id === id);
    if (index !== -1) {
      setPreviewIndex(index);
    }
  };

  const handleClosePreview = () => {
    setPreviewIndex(null);
  };

  const handleNextPreview = () => {
    if (previewIndex !== null && previewIndex < files.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  const handlePrevPreview = () => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  const handleClearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  };

  const handleDownloadAll = async () => {
    const finishedFiles = files.filter(f => f.status === 'done' && f.outputBlob);
    if (finishedFiles.length === 0) return;

    setIsZipping(true);
    setZipProgress(0);
    try {
      const zip = new JSZip();
      const nameCounts: Record<string, number> = {};

      finishedFiles.forEach(item => {
        let fileName = item.name;
        
        if (nameCounts[fileName]) {
          nameCounts[fileName]++;
          fileName = `${fileName} (${nameCounts[fileName]})`;
        } else {
          nameCounts[fileName] = 1;
        }

        const extension = outputFormat === 'webp' ? 'webp' : item.originalExtension;
        const finalName = extension ? `${fileName}.${extension}` : fileName;

        if (item.outputBlob) {
          zip.file(finalName, item.outputBlob);
        }
      });

      const zipName = outputFormat === 'webp' ? 'imagens_webp.zip' : 'imagens_processadas.zip';
      
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setZipProgress(metadata.percent);
      });
      
      saveAs(content, zipName);
    } catch (error) {
      console.error("Failed to zip files", error);
      alert("Ocorreu um erro ao criar o arquivo ZIP.");
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  const doneCount = files.filter(f => f.status === 'done').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const totalCount = files.length;
  const isAllDone = totalCount > 0 && doneCount === totalCount;
  
  // Stats Calculations
  const totalOriginalSize = files.reduce((acc, item) => acc + item.sizeOriginal, 0);
  
  // We only count finished items for the "Output" and "Reduction" stats to be accurate
  const finishedItems = files.filter(f => f.status === 'done');
  const totalOutputSizeOfFinished = finishedItems.reduce((acc, item) => acc + item.sizeOutput, 0);
  const totalOriginalSizeOfFinished = finishedItems.reduce((acc, item) => acc + item.sizeOriginal, 0);
  
  const savedBytes = totalOriginalSizeOfFinished - totalOutputSizeOfFinished;
  const savedPercent = totalOriginalSizeOfFinished > 0 
    ? Math.round((savedBytes / totalOriginalSizeOfFinished) * 100) 
    : 0;

  // Calculate progress for conversion
  const conversionProgress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen relative text-gray-100 pb-20 font-sans isolate selection:bg-indigo-500 selection:text-white">
      <Starfield />
      
      {/* Preview Modal */}
      {previewIndex !== null && files[previewIndex] && (
        <ImagePreviewModal 
          isOpen={true}
          item={files[previewIndex]}
          onClose={handleClosePreview}
          onNext={handleNextPreview}
          onPrev={handlePrevPreview}
          hasNext={previewIndex < files.length - 1}
          hasPrev={previewIndex > 0}
          outputFormat={outputFormat}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/30">
              <Zap size={24} className="text-white fill-current" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
              WebP Master
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
           <div className="flex bg-gray-900/60 p-1 rounded-xl border border-gray-800 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('converter')}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300
                  ${activeTab === 'converter' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <Images size={18} />
                Converter Imagens
              </button>
              <button
                onClick={() => setActiveTab('wayback')}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300
                  ${activeTab === 'wayback' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <History size={18} />
                Wayback Machine
              </button>
           </div>
        </div>

        {/* Content Area */}
        {activeTab === 'converter' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
            {/* Unified Tool Description */}
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-3xl font-bold text-white drop-shadow-md">
                Conversão & Renomeação Inteligente
              </h2>
              <p className="text-gray-300 max-w-xl mx-auto drop-shadow-sm">
                Arraste imagens ou use <span className="text-indigo-300 font-mono bg-indigo-500/10 px-1 rounded">Ctrl+V</span> para colar direto. Converta para WebP, redimensione e renomeie em lote.
              </p>
            </div>

            {/* Upload Section */}
            <Dropzone onFilesAdded={handleFilesAdded} />

            {/* Unified Control Panel */}
            <div className="flex flex-col gap-8 p-6 bg-gray-900/60 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-md">
              
              {/* Format Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-2">
                  <Settings2 size={20} />
                  <h3>Formato de Saída</h3>
                </div>
                
                <div className="flex gap-2 p-1 bg-gray-950/80 rounded-lg border border-gray-800">
                  <button
                    onClick={() => handleFormatChange('webp')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-md text-sm font-medium transition-all
                      ${outputFormat === 'webp' 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                      }
                    `}
                  >
                    <Zap size={16} />
                    Converter WebP
                  </button>
                  <button
                    onClick={() => handleFormatChange('original')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-md text-sm font-medium transition-all
                      ${outputFormat === 'original' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                      }
                    `}
                  >
                    <Images size={16} />
                    Manter Original
                  </button>
                </div>
              </div>

              {/* Resize & Quality Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Resize Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 font-semibold mb-2 transition-colors ${outputFormat === 'webp' ? 'text-blue-400' : 'text-emerald-400'}`}>
                      <Scaling size={20} />
                      <h3>Redimensionar</h3>
                    </div>
                  </div>

                  <div className="flex gap-2 p-1 bg-gray-950/80 rounded-lg border border-gray-800 transition-opacity">
                    {[
                      { label: '0.5x', value: 0.5, desc: '50%' },
                      { label: '1x', value: 1, desc: 'Original' },
                      { label: '2x', value: 2, desc: '200%' },
                      { label: '3x', value: 3, desc: '300%' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleResizeChange(opt.value)}
                        className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-all
                          ${resizeScale === opt.value
                            ? outputFormat === 'webp' 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                          }
                        `}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] opacity-70">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold text-purple-400">
                      <Gauge size={20} />
                      <h3>Qualidade</h3>
                    </div>
                    <span className="text-sm font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>

                  <div className="h-[52px] flex items-center px-4 bg-gray-950/80 rounded-lg border border-gray-800">
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.05"
                      value={quality}
                      onChange={handleQualityChange}
                      onMouseUp={handleQualityCommit}
                      onTouchEnd={handleQualityCommit}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-800 w-full" />

              {/* Renaming Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <Type size={20} />
                  <h3>Padrão de Renomeação</h3>
                </div>

                <div className="flex flex-col gap-3">
                  <input
                      type="text"
                      value={bulkName}
                      onChange={(e) => handleBulkNameChange(e.target.value)}
                      placeholder="Ex: MinhaFoto (Vazio = nomes originais)"
                      className="w-full bg-gray-950/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox" 
                              checked={withNumbering}
                              onChange={(e) => handleNumberingToggle(e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </div>
                          <span className="flex items-center gap-1">
                            <Hash size={14} /> Numeração automática
                          </span>
                      </label>
                      {bulkName && (
                        <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                          {bulkName}{withNumbering ? '1' : ''}.{outputFormat === 'webp' ? 'webp' : 'ext'}
                        </span>
                      )}
                    </div>
                </div>
              </div>
            </div>

            {/* Global Actions Bar */}
            {files.length > 0 && (
              <div 
                ref={resultsRef}
                className="flex flex-wrap items-center justify-between gap-4 bg-gray-900/80 p-4 rounded-xl border border-gray-800 sticky top-20 z-40 backdrop-blur-md shadow-2xl"
              >
                {/* Status Section with Progress */}
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className="bg-gray-800 p-2 rounded-lg shrink-0">
                    {(isZipping || processingCount > 0) ? (
                        <Loader2 size={20} className="text-indigo-400 animate-spin" />
                    ) : (
                        <MonitorPlay size={20} className="text-indigo-400" />
                    )}
                  </div>
                  <div className="flex flex-col w-full max-w-sm gap-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-200">
                        {isZipping 
                          ? 'Compactando arquivos...' 
                          : processingCount > 0
                            ? `Convertendo ${processingCount} arquivo${processingCount > 1 ? 's' : ''}...`
                            : `${doneCount} de ${totalCount} prontos`
                        }
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {isZipping 
                          ? `${Math.round(zipProgress)}%` 
                          : `${Math.round(conversionProgress)}%`
                        }
                      </span>
                    </div>
                    
                    {/* Progress Bar Track */}
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                      <div 
                        className={`h-full transition-all duration-300 ease-out rounded-full ${isZipping ? 'bg-purple-500' : 'bg-indigo-500'}`}
                        style={{ width: `${isZipping ? zipProgress : conversionProgress}%` }}
                      />
                    </div>

                    {/* Stats Summary */}
                    <div className="flex items-center justify-between text-[11px] sm:text-xs text-gray-400 mt-1 font-mono">
                         <span>Total: {formatBytes(totalOriginalSize)}</span>
                         {finishedItems.length > 0 && (
                             <span className="flex items-center gap-1.5">
                                 <span className="text-gray-600 hidden sm:inline">→</span>
                                 <span className="text-indigo-300">{formatBytes(totalOutputSizeOfFinished)}</span>
                                 {savedBytes > 0 ? (
                                    <span className="text-emerald-400 bg-emerald-500/10 px-1 rounded flex items-center">
                                       <ArrowUp size={10} className="rotate-180" /> {savedPercent}%
                                    </span>
                                 ) : savedBytes < 0 ? (
                                    <span className="text-orange-400 bg-orange-500/10 px-1 rounded flex items-center">
                                       <ArrowUp size={10} /> {Math.abs(savedPercent)}%
                                    </span>
                                 ) : null}
                             </span>
                         )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                    Limpar
                  </button>
                  
                  <button
                    onClick={handleDownloadAll}
                    disabled={!isAllDone || isZipping}
                    className={`
                      flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg
                      ${!isAllDone || isZipping 
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border border-indigo-500/50 shadow-indigo-500/20'
                      }
                    `}
                  >
                    {isZipping ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Gerando ZIP...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Baixar Tudo
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Sortable List Section */}
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={files.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 gap-3">
                  {files.map((file, index) => (
                    <SortableImageItem
                      key={file.id}
                      id={file.id}
                      item={file}
                      outputFormat={outputFormat}
                      resizeScale={resizeScale}
                      onRemove={handleRemove}
                      onRename={handleRename}
                      onPreview={handleOpenPreview}
                      onMoveUp={() => handleMoveUp(file.id)}
                      onMoveDown={() => handleMoveDown(file.id)}
                      isFirst={index === 0}
                      isLast={index === files.length - 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
             <div className="text-center space-y-2 mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                <h2 className="text-3xl font-bold text-white drop-shadow-md">
                  Máquina do Tempo
                </h2>
                <p className="text-gray-300 max-w-xl mx-auto drop-shadow-sm">
                  Viaje pelo histórico de qualquer website. Encontre, visualize e abra versões antigas arquivadas pelo Wayback Machine.
                </p>
             </div>
             <WaybackMachine />
          </div>
        )}

      </main>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`
          fixed bottom-8 right-8 z-50 p-3 rounded-full shadow-2xl backdrop-blur-md border border-indigo-500/30
          bg-gray-900/80 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500
          transition-all duration-300 transform
          ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}
        `}
        aria-label="Voltar ao topo"
      >
        <ArrowUp size={24} />
      </button>

    </div>
  );
};

export default App;
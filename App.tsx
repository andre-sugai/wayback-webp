import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  Trash2, Download, Zap, Images, Settings2, 
  Type, Hash, MonitorPlay, Loader2, ArrowUp, History, Scaling, Gauge,
  ArrowUpDown, ArrowDownNarrowWide, ArrowDownWideNarrow, ArrowDownAZ, ArrowUpAZ, ChevronDown
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
  const [resizeMode, setResizeMode] = useState<'preset' | 'custom'>('preset');
  const [customWidth, setCustomWidth] = useState<number>(1080);
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
  const [prefixOrder, setPrefixOrder] = useState(true);

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

  // Helper to apply naming pattern with leading zeros (01, 02... 10) so file managers sort in exact order
  const applyNamingPattern = useCallback((currentFiles: ProcessedImage[], baseName: string, numbering: boolean): ProcessedImage[] => {
    if (!baseName) return currentFiles;
    const padLength = Math.max(2, String(currentFiles.length).length);

    return currentFiles.map((file, index) => {
      const numStr = numbering ? String(index + 1).padStart(padLength, '0') : '';
      return {
        ...file,
        name: numbering ? `${baseName}${numStr}` : baseName
      };
    });
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
          const targetWidth = resizeMode === 'custom' ? customWidth : null;
          
          if (outputFormat === 'original' && resizeMode === 'preset' && resizeScale === 1 && quality >= 0.99) {
             // Pass-through optimization: No processing needed if format is original, scale is 1 AND quality is max
             // NOTE: If quality is lower, we allow processing even for original to apply compression
             outputBlob = item.originalFile;
             // Small delay for UX simulation so user sees 'processing' briefly if batch is large
             await new Promise(r => setTimeout(r, 50));
          } else {
             // Process: Convert to WebP OR Resize/Compress Original using Canvas
             outputBlob = await processImage(item.originalFile, resizeScale, outputFormat, quality, targetWidth);
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
  }, [files, outputFormat, resizeScale, quality, resizeMode, customWidth]);

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
    setResizeMode('preset');
    if (scale === resizeScale && resizeMode === 'preset') return;
    
    setResizeScale(scale);
    
    // Re-process all files
    setFiles(prev => prev.map(f => ({
      ...f,
      status: 'pending',
      outputBlob: null,
      sizeOutput: 0
    })));
  };

  // Handle Custom Width Mode
  const handleCustomWidthSelect = () => {
    setResizeMode('custom');
    if (resizeMode === 'custom') return;

    // Re-process all files
    setFiles(prev => prev.map(f => ({
      ...f,
      status: 'pending',
      outputBlob: null,
      sizeOutput: 0
    })));
  };

  // Commit Custom Width changes to trigger re-processing
  const handleCustomWidthCommit = () => {
    if (resizeMode === 'custom' && customWidth > 0) {
      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'pending',
        outputBlob: null,
        sizeOutput: 0
      })));
    }
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
       
       if (e.clipboardData) {
         const pastedFiles: File[] = [];
         
         // Extract files from e.clipboardData.files
         if (e.clipboardData.files && e.clipboardData.files.length > 0) {
           pastedFiles.push(...Array.from(e.clipboardData.files));
         } 
         // Fallback to e.clipboardData.items just in case
         else if (e.clipboardData.items && e.clipboardData.items.length > 0) {
           for (let i = 0; i < e.clipboardData.items.length; i++) {
             const item = e.clipboardData.items[i];
             if (item.kind === 'file') {
               const file = item.getAsFile();
               if (file) pastedFiles.push(file);
             }
           }
         }

         const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|avif|ico)$/i.test(f.name);
         const imageFiles = pastedFiles.filter(isImage);
         
         if (imageFiles.length > 0) {
           e.preventDefault();
           handleFilesAdded(imageFiles);
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

  // Sorting State & Handlers
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSort = (type: 'size-asc' | 'size-desc' | 'reverse' | 'name-asc' | 'name-desc') => {
    setShowSortMenu(false);
    setFiles(prev => {
      let sorted = [...prev];
      switch (type) {
        case 'size-asc':
          sorted.sort((a, b) => (a.sizeOriginal || 0) - (b.sizeOriginal || 0));
          break;
        case 'size-desc':
          sorted.sort((a, b) => (b.sizeOriginal || 0) - (a.sizeOriginal || 0));
          break;
        case 'reverse':
          sorted.reverse();
          break;
        case 'name-asc':
          sorted.sort((a, b) => a.originalFile.name.localeCompare(b.originalFile.name, undefined, { numeric: true, sensitivity: 'base' }));
          break;
        case 'name-desc':
          sorted.sort((a, b) => b.originalFile.name.localeCompare(a.originalFile.name, undefined, { numeric: true, sensitivity: 'base' }));
          break;
      }
      if (bulkName) {
        return applyNamingPattern(sorted, bulkName, withNumbering);
      }
      return sorted;
    });
  };

  const handleMoveToPosition = (id: string, targetPos: number) => {
    setFiles(prev => {
      const fromIndex = prev.findIndex(f => f.id === id);
      if (fromIndex === -1) return prev;

      const toIndex = Math.max(0, Math.min(prev.length - 1, targetPos - 1));
      if (fromIndex === toIndex) return prev;

      const newFiles = arrayMove(prev, fromIndex, toIndex);
      if (bulkName) {
        return applyNamingPattern(newFiles, bulkName, withNumbering);
      }
      return newFiles;
    });
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
      const padLength = Math.max(2, String(finishedFiles.length).length);
      const baseTime = Date.now() - (finishedFiles.length * 2000);

      finishedFiles.forEach((item, index) => {
        let fileName = item.name;
        
        // If prefixOrder is enabled and no custom bulkName is active, prefix with 01_, 02_...
        // so operating systems (Windows Explorer / macOS Finder) sort them in the exact list order
        if (prefixOrder && !bulkName) {
          const prefix = String(index + 1).padStart(padLength, '0');
          if (!fileName.startsWith(`${prefix}_`) && !fileName.startsWith(`${prefix}-`)) {
            fileName = `${prefix}_${fileName}`;
          }
        }

        if (nameCounts[fileName]) {
          nameCounts[fileName]++;
          fileName = `${fileName} (${nameCounts[fileName]})`;
        } else {
          nameCounts[fileName] = 1;
        }

        const extension = outputFormat === 'webp' ? 'webp' : item.originalExtension;
        const finalName = extension ? `${fileName}.${extension}` : fileName;

        if (item.outputBlob) {
          // Add sequential timestamp so file managers sorting by Date also preserve order
          zip.file(finalName, item.outputBlob, {
            date: new Date(baseTime + index * 1000)
          });
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
          resizeScale={resizeScale}
          targetWidth={resizeMode === 'custom' ? customWidth : null}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/30">
              <Zap size={24} className="text-white fill-current" />
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
                WebP Master
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                v1.1.0
              </span>
            </div>
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
                  <div className="flex items-center justify-between h-7 mb-2">
                    <div className={`flex items-center gap-2 font-semibold transition-colors ${outputFormat === 'webp' ? 'text-blue-400' : 'text-emerald-400'}`}>
                      <Scaling size={20} />
                      <h3>Redimensionar</h3>
                    </div>
                    {resizeMode === 'custom' && customWidth > 0 && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${outputFormat === 'webp' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                        {customWidth}px largura
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5 p-1 bg-gray-950/80 rounded-lg border border-gray-800 h-[58px] items-center">
                    {[
                      { label: '0.35x', value: 0.35, desc: '35%' },
                      { label: '0.5x', value: 0.5, desc: '50%' },
                      { label: '0.75x', value: 0.75, desc: '75%' },
                      { label: '1x', value: 1, desc: 'Original' },
                      { label: '2x', value: 2, desc: '200%' },
                      { label: '3x', value: 3, desc: '300%' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleResizeChange(opt.value)}
                        className={`flex-1 h-full flex flex-col items-center justify-center rounded-md text-sm font-medium transition-all
                          ${resizeMode === 'preset' && resizeScale === opt.value
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

                    {/* Custom Button */}
                    <button
                      onClick={handleCustomWidthSelect}
                      className={`flex-1 h-full min-w-[58px] flex flex-col items-center justify-center rounded-md text-sm font-medium transition-all
                        ${resizeMode === 'custom'
                          ? outputFormat === 'webp' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }
                      `}
                    >
                      <span>Custom</span>
                      <span className="text-[10px] opacity-70">Largura</span>
                    </button>
                  </div>

                  {/* Custom Width Input Box */}
                  {resizeMode === 'custom' && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-gray-900/90 border border-gray-700/80 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-200">Largura em Pixels (px)</span>
                        <span className="text-[11px] text-gray-400">A altura será ajustada proporcionalmente</span>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-36">
                          <input
                            type="number"
                            min="10"
                            max="10000"
                            step="10"
                            value={customWidth || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setCustomWidth(isNaN(val) ? 0 : val);
                            }}
                            onBlur={handleCustomWidthCommit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomWidthCommit();
                              }
                            }}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-9"
                            placeholder="ex: 1200"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono pointer-events-none select-none">
                            px
                          </span>
                        </div>
                        <button
                          onClick={handleCustomWidthCommit}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm ${
                            outputFormat === 'webp'
                              ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                          }`}
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between h-7 mb-2">
                    <div className="flex items-center gap-2 font-semibold text-purple-400">
                      <Gauge size={20} />
                      <h3>Qualidade</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {quality >= 0.99 && (
                        <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                          Máxima
                        </span>
                      )}
                      <span className="text-sm font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
                        {Math.round(quality * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="h-[58px] flex flex-col justify-center px-4 bg-gray-950/80 rounded-lg border border-gray-800 gap-1.5">
                    <div className="relative w-full flex items-center">
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.05"
                        value={quality}
                        onChange={handleQualityChange}
                        onMouseUp={handleQualityCommit}
                        onTouchEnd={handleQualityCommit}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 z-10 relative"
                      />
                    </div>

                    {/* Step indicator dots every 5% */}
                    <div className="relative w-full flex justify-between px-[7px] pointer-events-none select-none">
                      {Array.from({ length: 19 }, (_, i) => {
                        const val = 0.1 + i * 0.05;
                        const isCurrent = Math.abs(quality - val) < 0.01;
                        const isMajor = Math.round(val * 100) % 25 === 0 || Math.round(val * 100) === 100;
                        return (
                          <span 
                            key={i} 
                            className={`rounded-full transition-all ${
                              isCurrent 
                                ? 'w-1.5 h-1.5 bg-purple-400 shadow-sm shadow-purple-500/50 scale-125' 
                                : isMajor 
                                  ? 'w-1 h-1 bg-gray-500' 
                                  : 'w-1 h-1 bg-gray-700/80'
                            }`} 
                          />
                        );
                      })}
                    </div>
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
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-5">
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
                              <Hash size={14} /> Numeração sequencial (01, 02...)
                            </span>
                        </label>

                        {!bulkName && (
                          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  checked={prefixOrder}
                                  onChange={(e) => setPrefixOrder(e.target.checked)}
                                  className="peer sr-only"
                                />
                                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                              </div>
                              <span className="flex items-center gap-1">
                                Prefixar ordem no ZIP (01_, 02_...)
                              </span>
                          </label>
                        )}
                      </div>

                      {bulkName && (
                        <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                          Ex: {bulkName}{withNumbering ? '01' : ''}.{outputFormat === 'webp' ? 'webp' : 'ext'}
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
            <div className="space-y-3">
              {/* List Header with Count & Sort Controls */}
              <div className="flex items-center justify-between px-1 text-xs text-gray-400">
                <span className="font-semibold uppercase tracking-wider text-gray-500">
                  Fila de Imagens ({files.length})
                </span>

                {/* Sort Dropdown Menu */}
                <div className="relative" ref={sortMenuRef}>
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 hover:border-gray-600 text-gray-300 hover:text-white transition-all text-xs font-medium shadow-sm active:scale-95"
                    title="Organizar ordem das imagens"
                  >
                    <ArrowUpDown size={14} className="text-indigo-400" />
                    <span>Organizar</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 text-gray-400 ${showSortMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800 flex items-center justify-between">
                        <span>Organizar Fila</span>
                        <span className="text-indigo-400 font-normal lowercase">ordem</span>
                      </div>
                      
                      <div className="py-1 space-y-0.5">
                        <button
                          onClick={() => handleSort('size-asc')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors text-left"
                        >
                          <ArrowDownNarrowWide size={15} className="text-indigo-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">Tamanho: Menor → Maior</span>
                            <span className="text-[10px] text-gray-400">Das mais leves para as mais pesadas</span>
                          </div>
                        </button>

                        <button
                          onClick={() => handleSort('size-desc')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors text-left"
                        >
                          <ArrowDownWideNarrow size={15} className="text-indigo-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">Tamanho: Maior → Menor</span>
                            <span className="text-[10px] text-gray-400">Das mais pesadas para as mais leves</span>
                          </div>
                        </button>

                        <div className="my-1 border-t border-gray-800/80" />

                        <button
                          onClick={() => handleSort('reverse')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-purple-600/20 hover:text-purple-300 transition-colors text-left"
                        >
                          <ArrowUpDown size={15} className="text-purple-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">Inverter Ordem</span>
                            <span className="text-[10px] text-gray-400">Enviadas por último primeiro</span>
                          </div>
                        </button>

                        <div className="my-1 border-t border-gray-800/80" />

                        <button
                          onClick={() => handleSort('name-asc')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors text-left"
                        >
                          <ArrowDownAZ size={15} className="text-emerald-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">Nome: A → Z (1 → 9)</span>
                            <span className="text-[10px] text-gray-400">Ordem alfabética e numérica</span>
                          </div>
                        </button>

                        <button
                          onClick={() => handleSort('name-desc')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors text-left"
                        >
                          <ArrowUpAZ size={15} className="text-emerald-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">Nome: Z → A (9 → 1)</span>
                            <span className="text-[10px] text-gray-400">Ordem inversa por nome</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                        index={index}
                        totalCount={files.length}
                        outputFormat={outputFormat}
                        resizeScale={resizeScale}
                        targetWidth={resizeMode === 'custom' ? customWidth : null}
                        onRemove={handleRemove}
                        onRename={handleRename}
                        onMoveToPosition={handleMoveToPosition}
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

/**
 * Processes an image file (Format conversion and/or Resizing) using Canvas.
 */
export const processImage = async (
  file: File, 
  scale: number = 1, 
  outputFormat: 'webp' | 'original' = 'webp', 
  quality: number = 0.8,
  targetWidth?: number | null
): Promise<Blob> => {
  // 1. Decode image using createImageBitmap if available for highest fidelity and color accuracy
  let source: ImageBitmap | HTMLImageElement;
  let originalWidth = 0;
  let originalHeight = 0;
  let objectUrlToRevoke: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      // Decode with full color fidelity and without lossy alpha premultiplication
      source = await createImageBitmap(file, {
        colorSpaceConversion: 'default',
        premultiplyAlpha: 'none'
      });
      originalWidth = source.width;
      originalHeight = source.height;
    } else {
      throw new Error('createImageBitmap not available');
    }
  } catch {
    // Fallback to HTMLImageElement via object URL
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      objectUrlToRevoke = url;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
    originalWidth = (source as HTMLImageElement).naturalWidth || (source as HTMLImageElement).width;
    originalHeight = (source as HTMLImageElement).naturalHeight || (source as HTMLImageElement).height;
  }

  try {
    // 2. Calculate dimensions
    let finalWidth: number;
    let finalHeight: number;

    if (targetWidth && targetWidth > 0 && originalWidth > 0) {
      finalWidth = Math.max(1, Math.round(targetWidth));
      const aspectRatio = originalHeight / originalWidth;
      finalHeight = Math.max(1, Math.round(finalWidth * aspectRatio));
    } else {
      finalWidth = Math.max(1, Math.floor(originalWidth * scale));
      finalHeight = Math.max(1, Math.floor(originalHeight * scale));
    }

    // 3. Setup Canvas with explicit colorSpace to avoid color shifts
    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;

    const ctx = (canvas.getContext('2d', {
      colorSpace: 'srgb',
      willReadFrequently: false
    }) || canvas.getContext('2d')) as CanvasRenderingContext2D | null;

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Only apply interpolation filtering when actual resizing is taking place
    // Keeping it false for 1:1 ensures pixel-perfect original sharpness
    const isResizing = finalWidth !== originalWidth || finalHeight !== originalHeight;
    if (isResizing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    } else {
      ctx.imageSmoothingEnabled = false;
    }

    ctx.drawImage(source, 0, 0, finalWidth, finalHeight);

    // 4. Output MIME type & Quality encoding
    let mimeType = 'image/webp';
    if (outputFormat === 'original') {
      mimeType = file.type || 'image/png';
    }

    // Clamp quality between 0.05 and 1.0 (1.0 is highest quality)
    const exportQuality = quality >= 0.999 ? 1.0 : Math.max(0.05, Math.min(1.0, quality));

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Conversion failed'));
          }
        },
        mimeType,
        exportQuality
      );
    });
  } finally {
    // Clean up resources
    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
};

/**
 * Gets dimensions of an image file
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      // Use natural dimensions here as well for consistency
      const dims = { 
        width: img.naturalWidth || img.width, 
        height: img.naturalHeight || img.height 
      };
      URL.revokeObjectURL(objectUrl);
      resolve(dims);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0 });
    };

    img.src = objectUrl;
  });
};

/**
 * Formats bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Triggers a download for a single blob
 */
export const downloadBlob = (blob: Blob, filename: string, extension: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // Ensure we don't double up extension if the filename already has it (though our app logic strips it)
  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
  const finalName = filename.endsWith(safeExt) ? filename : `${filename}${safeExt}`;
  
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

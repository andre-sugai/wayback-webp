
/**
 * Processes an image file (Format conversion and/or Resizing) using Canvas.
 */
export const processImage = (file: File, scale: number = 1, outputFormat: 'webp' | 'original' = 'webp', quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; // Attempt to handle CORS for local/proxy images
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Use natural dimensions to ensure we are scaling the real pixel data
        // img.width can sometimes report CSS width or 0 if not attached to DOM
        const originalWidth = img.naturalWidth || img.width;
        const originalHeight = img.naturalHeight || img.height;

        // Calculate scaled dimensions
        const targetWidth = Math.max(1, Math.floor(originalWidth * scale));
        const targetHeight = Math.max(1, Math.floor(originalHeight * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Use better interpolation for downscaling/upscaling if supported
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Determine output MIME type
        let mimeType = 'image/webp';
        if (outputFormat === 'original') {
          mimeType = file.type;
          // Note: Canvas toBlob might default to PNG if the browser doesn't support the specific original mime type (e.g. tiff)
          // or if it's not a standard web image.
        }

        try {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Conversion failed'));
              }
            },
            mimeType,
            quality
          );
        } catch (e) {
          reject(new Error('Canvas tainted. CORS restricted image.'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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

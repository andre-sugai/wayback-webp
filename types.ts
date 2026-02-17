export interface ProcessedImage {
  id: string;
  originalFile: File;
  previewUrl: string;
  name: string; // The user-editable name (without extension)
  originalExtension: string; // e.g., 'png', 'jpg'
  status: 'pending' | 'processing' | 'done' | 'error';
  outputBlob: Blob | null; // The result (either WebP or original)
  sizeOriginal: number;
  sizeOutput: number;
  width: number;
  height: number;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
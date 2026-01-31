// FILE: src/types/scanner.ts
// All scanner-related types centralized for easy maintenance

export type ScanMode = 'image' | 'barcode' | 'video';

export interface CapturedItem {
  id: string;
  type: 'photo' | 'video' | 'document' | 'certificate';
  data: string; // Compressed base64 for API
  thumbnail: string;
  name: string;
  selected: boolean;
  originalData?: string; // Original quality for Supabase upload
  metadata?: CapturedItemMetadata;
}

export interface CapturedItemMetadata {
  documentType?: 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other';
  description?: string;
  extractedText?: string;
  barcodes?: string[];
  videoFrames?: string[];
  originalSize?: number;
  compressedSize?: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  quality?: number;
}

export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
}

export interface UploadResult {
  url: string | null;
  error?: string;
}

export interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

// Analysis request types
export interface AnalysisItem {
  type: 'photo' | 'video' | 'document' | 'certificate';
  data: string;
  additionalFrames?: string[];
  metadata?: CapturedItemMetadata;
}

export interface AnalysisRequest {
  scanType: 'multi-modal';
  originalImageUrls: string[];
  categoryHint?: string;
  items: AnalysisItem[];
}

export interface AnalysisOptions {
  items: CapturedItem[];
  userId: string;
  accessToken: string;
  categoryHint?: string;
  onProgress?: (stage: string, progress: number) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
}

// Camera types
export interface CameraConstraints {
  facingMode?: 'user' | 'environment';
  deviceId?: string;
  width?: number;
  height?: number;
}

export interface CameraState {
  isActive: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId?: string;
  facingMode: 'user' | 'environment';
  error?: string;
}
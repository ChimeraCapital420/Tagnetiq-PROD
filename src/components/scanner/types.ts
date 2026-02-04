// FILE: src/components/scanner/types.ts
// All scanner-related type definitions
// Centralizes types for maintainability

// =============================================================================
// SCAN MODES
// =============================================================================
export type ScanMode = 'image' | 'barcode' | 'video';

// =============================================================================
// CAPTURED ITEMS
// =============================================================================
export interface CapturedItem {
  id: string;
  type: 'photo' | 'video' | 'document';
  data: string;           // base64 or blob URL
  thumbnail: string;      // Always base64 for preview
  name: string;
  selected: boolean;
  originalData?: string;  // Original before compression
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

// =============================================================================
// GHOST MODE
// =============================================================================
export interface GhostLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GhostStoreInfo {
  type: GhostStoreType;
  name: string;
  aisle?: string;
  shelf_price: number;
}

export type GhostStoreType = 
  | 'thrift'
  | 'antique'
  | 'estate'
  | 'garage'
  | 'flea'
  | 'pawn'
  | 'auction'
  | 'retail'
  | 'other';

export interface GhostData {
  is_ghost: boolean;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  store: {
    type: string;
    name: string;
    aisle?: string;
  };
  pricing: {
    shelf_price: number;
    estimated_value: number;
  };
  handling_time_hours: number;
  kpis: {
    estimated_margin: number;
    margin_percent: number;
    velocity_score: 'high' | 'medium' | 'low';
  };
  scanned_at: string;
}

export interface GhostModeState {
  isGhostMode: boolean;
  location: GhostLocation | null;
  storeInfo: GhostStoreInfo | null;
  isCapturingLocation: boolean;
  locationError: string | null;
  handlingHours: number;
  isReady: boolean;
}

// =============================================================================
// CAMERA CONTROLS
// =============================================================================
export interface CameraCapabilities {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
  focusMode: string[];
  exposureMode: string[];
  whiteBalanceMode: string[];
}

export interface CameraSettings {
  torch: boolean;
  zoom: number;
  focusMode: string;
  exposureMode: string;
  whiteBalanceMode: string;
}

// =============================================================================
// GRID OVERLAY
// =============================================================================
export type GridType = 'rule-of-thirds' | 'golden-ratio' | 'center-cross' | 'diagonal';

export interface GridOverlaySettings {
  enabled: boolean;
  type: GridType;
  opacity: number;
  color: string;
}

// =============================================================================
// SCANNER PROPS
// =============================================================================
export interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// ANALYSIS PAYLOAD
// =============================================================================
export interface AnalysisPayloadItem {
  type: 'photo' | 'video' | 'document';
  name: string;
  data: string;
  additionalFrames?: string[];
  metadata?: {
    documentType?: string;
    extractedText?: string;
    barcodes?: string[];
  };
  originalUrl?: string | null;
}

export interface AnalysisRequestPayload {
  scanType: 'multi-modal';
  items: AnalysisPayloadItem[];
  category_id: string;
  subcategory_id: string;
  originalImageUrls?: string[];
  ghostMode?: {
    enabled: boolean;
    shelfPrice: number;
    handlingHours: number;
    storeType: string;
    storeName: string;
    storeAisle?: string;
    location: {
      lat: number;
      lng: number;
      accuracy: number;
    };
  };
}
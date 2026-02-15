// FILE: src/components/scanner/components/ScannerFooter.tsx
// Extracted from DualScanner.tsx — bottom controls area
// Mobile-first: Large touch targets, thumb-zone placement, haptic on capture

import React from 'react';
import {
  Circle,
  Upload,
  Zap,
  Loader2,
  ImageIcon,
  Video,
  ScanLine,
  FileText,
  Ghost,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CapturePreviewGrid } from './CapturePreviewGrid';
import type { ScanMode, CapturedItem } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface ScannerFooterProps {
  /** Current scan mode */
  scanMode: ScanMode;
  /** Change scan mode */
  onScanModeChange: (mode: ScanMode) => void;
  /** Capture photo */
  onCapture: () => void;
  /** Start/stop video recording */
  onVideoToggle: () => void;
  /** Submit for analysis */
  onAnalyze: () => void;
  /** Open image upload picker */
  onImageUpload: () => void;
  /** Open document upload picker */
  onDocumentUpload: () => void;
  /** Currently processing/uploading */
  isProcessing: boolean;
  /** Currently compressing images */
  isCompressing: boolean;
  /** Currently recording video */
  isRecording: boolean;
  /** Ghost mode active */
  isGhostMode: boolean;
  /** Ghost mode fully configured */
  isGhostReady: boolean;
  /** All captured items */
  items: CapturedItem[];
  /** Number of selected items */
  selectedCount: number;
  /** Total item count */
  totalCount: number;
  /** Max items allowed */
  maxItems?: number;
  /** Toggle item selection */
  onToggleSelection: (id: string) => void;
  /** Remove item */
  onRemoveItem: (id: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ScannerFooter: React.FC<ScannerFooterProps> = ({
  scanMode,
  onScanModeChange,
  onCapture,
  onVideoToggle,
  onAnalyze,
  onImageUpload,
  onDocumentUpload,
  isProcessing,
  isCompressing,
  isRecording,
  isGhostMode,
  isGhostReady,
  items,
  selectedCount,
  totalCount,
  maxItems = 15,
  onToggleSelection,
  onRemoveItem,
}) => {
  const captureDisabled = isProcessing || isCompressing || totalCount >= maxItems;
  const analyzeDisabled =
    isProcessing || isCompressing || (isGhostMode && !isGhostReady);

  return (
    <div className="dual-scanner-footer relative bg-black/90 backdrop-blur-sm z-20">
      {/* Upload buttons row */}
      <div className="flex justify-center gap-3 px-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onImageUpload}
          disabled={captureDisabled}
          className="text-white/70 hover:text-white touch-manipulation text-xs"
        >
          <Upload className="w-4 h-4 mr-1" />
          Gallery
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDocumentUpload}
          disabled={captureDisabled}
          className="text-white/70 hover:text-white touch-manipulation text-xs"
        >
          <FileText className="w-4 h-4 mr-1" />
          Document
        </Button>
      </div>

      {/* Capture area */}
      {scanMode === 'image' && (
        <div className="relative flex items-center justify-center py-3">
          <Button
            onClick={onCapture}
            className={`capture-button touch-manipulation ${
              isGhostMode ? 'ring-4 ring-purple-500/50' : ''
            }`}
            size="icon"
            disabled={captureDisabled}
          >
            <Circle className="w-16 h-16 fill-white" />
          </Button>
        </div>
      )}

      {scanMode === 'barcode' && (
        <div className="flex items-center justify-center py-3 text-green-400 text-sm">
          <ScanLine className="w-5 h-5 mr-2 animate-pulse" />
          Point at barcode to scan
        </div>
      )}

      {scanMode === 'video' && (
        <div className="relative flex items-center justify-center py-3">
          <Button
            onClick={onVideoToggle}
            className="capture-button touch-manipulation"
            size="icon"
            disabled={isProcessing}
            style={{
              backgroundColor: isRecording ? '#ef4444' : 'transparent',
            }}
          >
            <Circle className="w-16 h-16 fill-white" />
          </Button>
        </div>
      )}

      {/* Analyze button — floats above when items are selected */}
      {selectedCount > 0 && (
        <div className="absolute right-3 -top-16 z-10">
          <Button
            onClick={onAnalyze}
            disabled={analyzeDisabled}
            size="lg"
            className={`touch-manipulation shadow-xl ${
              isGhostMode
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="animate-spin mr-1.5 h-4 w-4" />
            ) : isGhostMode ? (
              <Ghost className="mr-1.5 h-4 w-4" />
            ) : (
              <Zap className="mr-1.5 h-4 w-4" />
            )}
            {isGhostMode
              ? `👻 Ghost ${selectedCount}`
              : `Analyze ${selectedCount}`}
          </Button>
        </div>
      )}

      {/* Captured items preview strip */}
      <CapturePreviewGrid
        items={items}
        onToggleSelection={onToggleSelection}
        onRemove={onRemoveItem}
      />

      {/* Mode toggle bar */}
      <div className="mode-toggle flex justify-center gap-1 px-3 pb-3 pt-1">
        <Button
          onClick={() => onScanModeChange('image')}
          variant={scanMode === 'image' ? 'secondary' : 'ghost'}
          size="sm"
          className="touch-manipulation text-xs"
        >
          <ImageIcon className="mr-1 w-4 h-4" />
          Photo
        </Button>
        <Button
          onClick={() => onScanModeChange('barcode')}
          variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}
          size="sm"
          className="touch-manipulation text-xs"
        >
          <ScanLine className="mr-1 w-4 h-4" />
          Barcode
        </Button>
        <Button
          onClick={() => onScanModeChange('video')}
          variant={scanMode === 'video' ? 'secondary' : 'ghost'}
          size="sm"
          className="touch-manipulation text-xs"
        >
          <Video className="mr-1 w-4 h-4" />
          Video
        </Button>
      </div>
    </div>
  );
};

export default ScannerFooter;
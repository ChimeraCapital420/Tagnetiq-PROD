// FILE: src/components/scanner/hooks/useBarcodeScanner.ts
// Extracted from DualScanner.tsx — barcode scanning via react-zxing
// Mobile-first: Haptic feedback on detection, auto-submit result

import { useState, useCallback, useRef } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';

// =============================================================================
// TYPES
// =============================================================================

export interface UseBarcodeScannerOptions {
  /** Current device ID for camera */
  deviceId?: string;
  /** Whether barcode mode is active */
  enabled: boolean;
  /** Whether scanner is open */
  isOpen: boolean;
  /** Whether currently processing another scan */
  isProcessing: boolean;
  /** Called after successful barcode detection */
  onDetected?: (barcode: string) => void;
}

export interface UseBarcodeScannerReturn {
  /** Ref to attach to hidden video element for zxing */
  zxingRef: React.RefObject<HTMLVideoElement>;
  /** Last detected barcode */
  lastBarcode: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBarcodeScanner(
  options: UseBarcodeScannerOptions
): UseBarcodeScannerReturn {
  const { deviceId, enabled, isOpen, isProcessing, onDetected } = options;
  const { setLastAnalysisResult, setIsAnalyzing } = useAppContext();
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const debounceRef = useRef<number>(0);

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      // Debounce — prevent duplicate scans within 2 seconds
      const now = Date.now();
      if (now - debounceRef.current < 2000) return;
      debounceRef.current = now;

      setLastBarcode(barcode);

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }

      toast.success(`Barcode detected: ${barcode}`);

      // Build a minimal analysis result for barcode scans
      setLastAnalysisResult({
        id: uuidv4(),
        decision: 'BUY',
        itemName: `Barcode: ${barcode}`,
        estimatedValue: 0.0,
        confidenceScore: 50,
        summary_reasoning: 'Barcode scanned, ready for lookup.',
        analysis_quality: 'OPTIMAL',
        valuation_factors: ['Barcode Detection'],
        capturedAt: new Date().toISOString(),
        category: 'barcode',
        imageUrl: '',
        imageUrls: [],
        marketComps: [],
        hydraConsensus: {
          totalSources: 0,
          votes: [],
          allVotes: [],
          aiModels: { responded: [], weights: {} },
          apiSources: { responded: [], data: {} },
          consensusMethod: 'barcode_lookup',
          finalConfidence: 0.5,
        },
        resale_toolkit: {
          listInArena: true,
          sellOnProPlatforms: true,
          linkToMyStore: false,
          shareToSocial: true,
        },
        tags: ['barcode'],
      });

      setIsAnalyzing(true);
      onDetected?.(barcode);
    },
    [setLastAnalysisResult, setIsAnalyzing, onDetected]
  );

  const { ref: zxingRef } = useZxing({
    deviceId,
    onResult(result) {
      if (enabled && !isProcessing) {
        handleBarcodeDetected(result.getText());
      }
    },
    paused: !enabled || !isOpen || isProcessing,
  });

  return {
    zxingRef,
    lastBarcode,
  };
}

export default useBarcodeScanner;
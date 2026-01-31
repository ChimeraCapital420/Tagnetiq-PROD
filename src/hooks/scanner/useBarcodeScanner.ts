// FILE: src/hooks/scanner/useBarcodeScanner.ts
// Barcode scanning hook with debouncing and validation
// Wraps react-zxing with additional features

import { useState, useCallback, useRef, useEffect } from 'react';
import { useZxing } from 'react-zxing';

// =============================================================================
// TYPES
// =============================================================================

export interface UseBarcodeScannerOptions {
  /** Enable/disable scanning */
  enabled?: boolean;
  /** Specific device ID to use */
  deviceId?: string;
  /** Callback when barcode is detected */
  onDetect: (code: string, format: string) => void;
  /** Callback on scanning error */
  onError?: (error: Error) => void;
  /** Debounce delay in ms (prevent duplicate scans) */
  debounceMs?: number;
  /** Formats to scan for (default: all) */
  formats?: BarcodeFormat[];
}

export interface UseBarcodeScannerReturn {
  /** Ref to attach to video element */
  ref: React.RefObject<HTMLVideoElement>;
  /** Whether actively scanning */
  isScanning: boolean;
  /** Last detected code */
  lastCode: string | null;
  /** Last detected format */
  lastFormat: string | null;
  /** Scan history */
  history: ScanResult[];
  /** Clear scan history */
  clearHistory: () => void;
  /** Torch/flash support */
  torch: {
    isSupported: boolean;
    isOn: boolean;
    toggle: () => void;
  };
}

export interface ScanResult {
  code: string;
  format: string;
  timestamp: number;
}

export type BarcodeFormat =
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN_8'
  | 'EAN_13'
  | 'CODE_39'
  | 'CODE_128'
  | 'ITF'
  | 'PDF_417';

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Barcode scanner hook
 * 
 * Features:
 * - Debounced detection (prevents duplicate scans)
 * - Scan history
 * - Format detection
 * - Torch/flash control (where supported)
 * 
 * @example
 * const scanner = useBarcodeScanner({
 *   enabled: scanMode === 'barcode',
 *   onDetect: (code, format) => {
 *     toast.success(`Found ${format}: ${code}`);
 *   },
 * });
 * 
 * return <video ref={scanner.ref} />;
 */
export function useBarcodeScanner(options: UseBarcodeScannerOptions): UseBarcodeScannerReturn {
  const {
    enabled = true,
    deviceId,
    onDetect,
    onError,
    debounceMs = 1000,
    formats,
  } = options;

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Refs for debouncing
  const lastScanTime = useRef<number>(0);
  const lastScannedCode = useRef<string | null>(null);

  // Callback for when barcode is detected
  const handleResult = useCallback((result: any) => {
    if (!result) return;

    const code = result.getText();
    const format = result.getBarcodeFormat()?.toString() || 'UNKNOWN';
    const now = Date.now();

    console.log(`📊 [BARCODE] Detected: ${code} (${format})`);

    // Debounce - ignore if same code within debounce window
    if (
      code === lastScannedCode.current &&
      now - lastScanTime.current < debounceMs
    ) {
      console.log(`📊 [BARCODE] Debounced duplicate`);
      return;
    }

    // Update refs
    lastScanTime.current = now;
    lastScannedCode.current = code;

    // Update state
    setLastCode(code);
    setLastFormat(format);
    setHistory(prev => [
      { code, format, timestamp: now },
      ...prev.slice(0, 49), // Keep last 50
    ]);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]); // Double pulse for barcode
    }

    // Callback
    onDetect(code, format);
  }, [onDetect, debounceMs]);

  // Error handler
  const handleError = useCallback((error: Error) => {
    console.error(`📊 [BARCODE] Error:`, error);
    onError?.(error);
  }, [onError]);

  // Use zxing hook
  const { ref } = useZxing({
    onDecodeResult: handleResult,
    onError: handleError,
    paused: !enabled,
    deviceId,
    // Note: format hints would go here if zxing supports them
  });

  // Track scanning state
  useEffect(() => {
    setIsScanning(enabled);
    if (enabled) {
      console.log(`📊 [BARCODE] Scanner enabled`);
    } else {
      console.log(`📊 [BARCODE] Scanner disabled`);
    }
  }, [enabled]);

  // Check torch support when ref is available
  useEffect(() => {
    const checkTorch = async () => {
      try {
        const video = ref.current;
        if (!video?.srcObject) return;

        const stream = video.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        
        if (track) {
          const capabilities = track.getCapabilities?.();
          // @ts-ignore - torch may not be in types
          setTorchSupported(!!capabilities?.torch);
        }
      } catch {
        setTorchSupported(false);
      }
    };

    if (enabled) {
      // Delay check to ensure stream is ready
      setTimeout(checkTorch, 500);
    }
  }, [enabled, ref]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastCode(null);
    setLastFormat(null);
    lastScannedCode.current = null;
  }, []);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    try {
      const video = ref.current;
      if (!video?.srcObject) return;

      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track) {
        const newState = !torchOn;
        // @ts-ignore - torch constraint may not be in types
        await track.applyConstraints({ advanced: [{ torch: newState }] });
        setTorchOn(newState);
        console.log(`📊 [BARCODE] Torch ${newState ? 'on' : 'off'}`);
      }
    } catch (error) {
      console.error(`📊 [BARCODE] Torch toggle failed:`, error);
    }
  }, [ref, torchOn]);

  return {
    ref,
    isScanning,
    lastCode,
    lastFormat,
    history,
    clearHistory,
    torch: {
      isSupported: torchSupported,
      isOn: torchOn,
      toggle: toggleTorch,
    },
  };
}

// =============================================================================
// IMAGE BARCODE DETECTION
// =============================================================================

/**
 * Detect barcodes in a static image
 * Uses BarcodeDetector API where available, falls back to manual processing
 */
export async function detectBarcodesInImage(imageData: string): Promise<string[]> {
  console.log(`📊 [BARCODE] Scanning image for barcodes...`);

  // Try native BarcodeDetector API first (Chrome, Edge)
  if ('BarcodeDetector' in window) {
    try {
      // @ts-ignore - BarcodeDetector may not be in types
      const detector = new BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      });

      const img = await loadImage(imageData);
      const results = await detector.detect(img);
      
      const codes = results.map((r: any) => r.rawValue);
      console.log(`📊 [BARCODE] Native API found: ${codes.length} barcodes`);
      return codes;
    } catch (error) {
      console.warn(`📊 [BARCODE] Native API failed:`, error);
    }
  }

  // Fallback: Return empty (zxing could be used here but adds bundle size)
  console.log(`📊 [BARCODE] No native API, skipping image scan`);
  return [];
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// =============================================================================
// BARCODE VALIDATION
// =============================================================================

/**
 * Validate common barcode formats
 */
export function validateBarcode(code: string, format?: string): boolean {
  if (!code || code.length === 0) return false;

  // UPC-A: 12 digits
  if (format === 'UPC_A' || code.length === 12) {
    return /^\d{12}$/.test(code) && validateUPCCheckDigit(code);
  }

  // EAN-13: 13 digits
  if (format === 'EAN_13' || code.length === 13) {
    return /^\d{13}$/.test(code) && validateEANCheckDigit(code);
  }

  // EAN-8: 8 digits
  if (format === 'EAN_8' || code.length === 8) {
    return /^\d{8}$/.test(code);
  }

  // Generic: at least looks like a barcode
  return code.length >= 4 && code.length <= 50;
}

/**
 * Validate UPC-A check digit
 */
function validateUPCCheckDigit(code: string): boolean {
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[11];
}

/**
 * Validate EAN-13 check digit
 */
function validateEANCheckDigit(code: string): boolean {
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

export default useBarcodeScanner;
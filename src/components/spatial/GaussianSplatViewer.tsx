// FILE: src/components/spatial/GaussianSplatViewer.tsx
// RH-043 — Gaussian Splat Spatial Intelligence Viewer
// Embeds SuperSplat (PlayCanvas, MIT license) as a React component.
// Renders photorealistic 3D scenes from .splat files in the browser.
// No special hardware — phone photos → Luma AI API → .splat → viewer.
//
// Phase 1: Viewer only (embed SuperSplat iframe or canvas)
// Phase 2: Luma AI capture pipeline integration
// Phase 3: HYDRA hotspot annotations on 3D points
//
// Usage:
//   <GaussianSplatViewer splatUrl="https://..." itemName="Living Room" />
//
// To capture a new splat:
//   1. Take 30-60 photos walking around the subject
//   2. Upload to Luma AI (lumaai.com/api — free tier available)
//   3. Download the .splat file
//   4. Pass URL to this component

import React, { useState, useRef, useCallback } from 'react';
import { Box, Upload, Loader2, AlertCircle, Maximize2, Info } from 'lucide-react';

interface GaussianSplatViewerProps {
  splatUrl?: string;
  itemName?: string;
  height?: number;
  allowUpload?: boolean;
  className?: string;
  onHotspot?: (position: { x: number; y: number; z: number }) => void;
}

const SUPERSPLAT_BASE = 'https://playcanvas.com/supersplat/editor';

// Luma AI sample splat for testing — the Luma office lobby
const SAMPLE_SPLAT_URL = 'https://lumaai.com/embed/splats/luma-office.splat';

const GaussianSplatViewer: React.FC<GaussianSplatViewerProps> = ({
  splatUrl,
  itemName = 'Scene',
  height = 400,
  allowUpload = false,
  className = '',
  onHotspot,
}) => {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(splatUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the SuperSplat embed URL
  // SuperSplat can load external .splat files via URL parameter
  const buildViewerUrl = useCallback((splat: string): string => {
    // For public splat files, use SuperSplat's built-in viewer
    // SuperSplat viewer endpoint with model param
    const encoded = encodeURIComponent(splat);
    return `${SUPERSPLAT_BASE}?load=${encoded}`;
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.splat') && !file.name.endsWith('.ply')) {
      setError('Please upload a .splat or .ply file from Luma AI or SuperSplat.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a local object URL for the file
      const url = URL.createObjectURL(file);
      setLoadedUrl(url);
    } catch {
      setError('Could not load file. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-white/10 bg-black overflow-hidden ${className}`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border-b border-white/10">
        <Box className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-white flex-1 truncate">{itemName}</p>
        <div className="flex items-center gap-2">
          {allowUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".splat,.ply"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Load .splat
              </button>
            </>
          )}
          <button
            onClick={handleFullscreen}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative" style={{ height: `calc(100% - 44px)` }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="flex items-center gap-2 text-white/60">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Processing splat...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loadedUrl && !error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
            <Box className="w-12 h-12 text-white/20" />
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">3D Scene Viewer</p>
              <p className="text-xs text-white/30 leading-relaxed max-w-xs">
                Capture 30–60 photos of any space or object, process with{' '}
                <a href="https://lumaai.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  Luma AI
                </a>
                , then load the .splat file here.
              </p>
            </div>
            {allowUpload && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-all active:scale-[0.98]"
              >
                <Upload className="w-4 h-4" />
                Load .splat File
              </button>
            )}
            <div className="flex items-start gap-1.5 text-left max-w-xs">
              <Info className="w-3.5 h-3.5 text-white/20 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/20 leading-relaxed">
                SuperSplat viewer powered by PlayCanvas (MIT license). Luma AI free tier: 10 captures/month.
              </p>
            </div>
          </div>
        )}

        {loadedUrl && !error && (
          <iframe
            src={buildViewerUrl(loadedUrl)}
            className="w-full h-full border-0"
            title={`3D Scan: ${itemName}`}
            allow="xr-spatial-tracking; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
};

export default GaussianSplatViewer;
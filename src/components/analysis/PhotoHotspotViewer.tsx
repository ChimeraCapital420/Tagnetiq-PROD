// FILE: src/components/analysis/PhotoHotspotViewer.tsx
// RH-022 — Interactive Photo Hotspots
// User taps any region of a scan photo to get targeted AI analysis.
// Mobile-first: touch events capture tap coordinates as percentages.
//
// Usage:
//   <PhotoHotspotViewer
//     imageUrl={scanResult.thumbnailUrl}
//     imageBase64={imageBase64}
//     itemName={result.itemName}
//     category={result.category}
//     isLuxury={!!result.luxuryAuthentication}
//   />

import React, { useState, useRef, useCallback } from 'react';
import { Search, Shield, AlertTriangle, DollarSign, Loader2, X, ZoomIn } from 'lucide-react';

type HotspotIntent = 'identify' | 'authenticate' | 'damage' | 'value';

interface HotspotResult {
  intent: HotspotIntent;
  summary: string;
  result: Record<string, any>;
  tapPosition: { x: number; y: number };
  authenticitySignal?: 'authentic' | 'suspicious' | 'inconclusive';
  damageSeverity?: 'none' | 'minor' | 'moderate' | 'significant';
  valueImpact?: 'positive' | 'negative' | 'neutral';
  identifiedText?: string;
}

interface PhotoHotspotViewerProps {
  imageUrl?: string | null;
  imageBase64?: string;
  itemName: string;
  category?: string;
  analysisId?: string;
  userId?: string;
  isLuxury?: boolean;
  className?: string;
}

const INTENT_CONFIG: Record<HotspotIntent, {
  label: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
  description: string;
}> = {
  identify: {
    label: 'Identify',
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-600',
    description: 'Tap to read text, labels, or markings',
  },
  authenticate: {
    label: 'Authenticate',
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-600',
    description: 'Tap to check stitching, hardware, or logos',
  },
  damage: {
    label: 'Damage',
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-600',
    description: 'Tap to assess wear, scratches, or defects',
  },
  value: {
    label: 'Value',
    icon: DollarSign,
    color: 'text-emerald-400',
    bg: 'bg-emerald-600',
    description: 'Tap to assess how this area affects price',
  },
};

const SIGNAL_COLORS = {
  authentic:    'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
  suspicious:   'text-red-400 bg-red-950/40 border-red-500/30',
  inconclusive: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
  none:         'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
  minor:        'text-yellow-400 bg-yellow-950/40 border-yellow-500/30',
  moderate:     'text-orange-400 bg-orange-950/40 border-orange-500/30',
  significant:  'text-red-400 bg-red-950/40 border-red-500/30',
  positive:     'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
  negative:     'text-red-400 bg-red-950/40 border-red-500/30',
  neutral:      'text-white/60 bg-white/5 border-white/10',
};

const PhotoHotspotViewer: React.FC<PhotoHotspotViewerProps> = ({
  imageUrl,
  imageBase64,
  itemName,
  category = 'general',
  analysisId,
  userId,
  isLuxury = false,
  className = '',
}) => {
  const [activeIntent, setActiveIntent] = useState<HotspotIntent>('identify');
  const [loading, setLoading] = useState(false);
  const [hotspotResult, setHotspotResult] = useState<HotspotResult | null>(null);
  const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageTap = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageRef.current) return;
    if (loading) return;

    e.preventDefault();

    // Get tap coordinates as percentage of image dimensions
    const rect = imageRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const tapX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const tapY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setTapPosition({ x: tapX, y: tapY });
    setLoading(true);
    setHotspotResult(null);

    // Get base64 — prefer direct if provided, otherwise fetch from URL
    let base64 = imageBase64;
    if (!base64 && imageUrl) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split('base64,')[1] || result);
          };
          reader.readAsDataURL(blob);
        });
      } catch {
        setLoading(false);
        return;
      }
    }

    if (!base64) { setLoading(false); return; }

    try {
      const res = await fetch('/api/photo-hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          cropX: tapX,
          cropY: tapY,
          cropRadius: 0.15,
          itemName,
          category,
          analysisId,
          userId,
          hotspotIntent: activeIntent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setHotspotResult({ ...data.hotspot, tapPosition: { x: tapX, y: tapY } });
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [activeIntent, imageBase64, imageUrl, itemName, category, analysisId, userId, loading]);

  if (!imageUrl && !imageBase64) return null;

  const IntentConfig = INTENT_CONFIG[activeIntent];
  const IntentIcon = IntentConfig.icon;

  // Show authenticate intent by default for luxury items
  const availableIntents: HotspotIntent[] = isLuxury
    ? ['authenticate', 'identify', 'damage', 'value']
    : ['identify', 'damage', 'value'];

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <ZoomIn className="w-4 h-4 text-white/60 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Photo Analysis</p>
          <p className="text-xs text-white/40">Tap any area to analyze it</p>
        </div>
      </div>

      {/* Intent selector */}
      <div className="flex gap-1.5 px-3 py-2.5 border-b border-white/10 overflow-x-auto scrollbar-none">
        {availableIntents.map((intent) => {
          const cfg = INTENT_CONFIG[intent];
          const Icon = cfg.icon;
          const isActive = intent === activeIntent;
          return (
            <button
              key={intent}
              onClick={() => { setActiveIntent(intent); setHotspotResult(null); setTapPosition(null); }}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all border
                ${isActive
                  ? `${cfg.bg} text-white border-transparent`
                  : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                }
              `}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Image with tap zone */}
      <div className="relative">
        <img
          ref={imageRef}
          src={imageUrl || ''}
          alt={itemName}
          className={`w-full object-cover cursor-crosshair select-none ${isExpanded ? 'max-h-none' : 'max-h-64'}`}
          onClick={handleImageTap}
          onTouchEnd={handleImageTap}
          draggable={false}
        />

        {/* Tap indicator */}
        {tapPosition && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${tapPosition.x * 100}%`,
              top: `${tapPosition.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={`w-8 h-8 rounded-full border-2 ${
              loading ? 'border-white animate-ping' : `border-${IntentConfig.color.split('-')[1]}-400`
            } opacity-80`} />
            {!loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-2">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
              <span className="text-white text-xs">Analyzing...</span>
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(p => !p)}
          className="absolute bottom-2 right-2 bg-black/50 text-white/60 text-xs px-2 py-1 rounded-full"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Instruction when no result */}
      {!hotspotResult && !loading && (
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-white/40">{IntentConfig.description}</p>
        </div>
      )}

      {/* Result card */}
      {hotspotResult && (
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <IntentIcon className={`w-4 h-4 shrink-0 ${IntentConfig.color}`} />
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {IntentConfig.label} Result
              </p>
            </div>
            <button
              onClick={() => { setHotspotResult(null); setTapPosition(null); }}
              className="text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Signal badge */}
          {(hotspotResult.authenticitySignal || hotspotResult.damageSeverity || hotspotResult.valueImpact) && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mb-2
              ${SIGNAL_COLORS[hotspotResult.authenticitySignal || hotspotResult.damageSeverity || hotspotResult.valueImpact || 'neutral']}
            `}>
              {hotspotResult.authenticitySignal && `Auth: ${hotspotResult.authenticitySignal}`}
              {hotspotResult.damageSeverity && `Damage: ${hotspotResult.damageSeverity}`}
              {hotspotResult.valueImpact && `Value: ${hotspotResult.valueImpact}`}
            </div>
          )}

          <p className="text-sm text-white/80 leading-relaxed">{hotspotResult.summary}</p>

          {hotspotResult.identifiedText && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/40 mb-0.5">Identified text</p>
              <p className="text-sm text-white font-mono">{hotspotResult.identifiedText}</p>
            </div>
          )}

          {hotspotResult.result?.detail && hotspotResult.result.detail !== hotspotResult.summary && (
            <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{hotspotResult.result.detail}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoHotspotViewer;
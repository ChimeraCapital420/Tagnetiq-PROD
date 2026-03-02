// FILE: src/pages/HuntPage.tsx
// Hunt Mode Page — glasses capture → Oracle hunt triage → verdict overlay
//
// ARCHITECTURE:
//   SmartGlassesControl captures frames (single, batch, continuous)
//   → onCaptureItem fires with base64 JPEG
//   → POST /api/oracle/hunt { image, deviceType: 'glasses' }
//   → HuntResult { verdict, itemName, estimatedValue, reason }
//   → Floating verdict card overlay on camera feed
//
// MOBILE FIRST:
//   - Frame compression happens on device (Capacitor plugin)
//   - Only compressed JPEG sent to server (~150-200KB)
//   - Throttle: max 1 hunt call per 5 seconds (prevent API spam)
//   - Session stats tracked in local state (zero server cost)
//
// COST: ~$0.003-0.05 per hunt call depending on provider routing

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SmartGlassesControl from '@/components/SmartGlassesControl';
import {
  ArrowLeft,
  ShoppingCart,
  XCircle,
  Clock,
  Search,
  Zap,
  TrendingUp,
  Eye,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface HuntVerdict {
  verdict: 'BUY' | 'SKIP' | 'HOLD' | 'SCAN';
  itemName: string;
  estimatedValue: { low: number; high: number; display: string };
  reason: string;
  category: string;
  confidence: number;
  responseTime: number;
  provider: string;
  timestamp: number;
  id: string;
}

interface SessionStats {
  scansTotal: number;
  buys: number;
  skips: number;
  holds: number;
  totalEstimatedValue: number;
  startedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HUNT_THROTTLE_MS = 5000; // Min 5s between hunt calls (cost control)
const VERDICT_DISPLAY_MS = 8000; // Show verdict for 8s then fade
const MAX_VERDICT_STACK = 3; // Max overlapping verdict cards

// =============================================================================
// VERDICT COLORS & ICONS
// =============================================================================

const VERDICT_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  BUY: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/60',
    text: 'text-emerald-400',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  SKIP: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/50',
    text: 'text-red-400',
    icon: <XCircle className="w-5 h-5" />,
  },
  HOLD: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    icon: <Clock className="w-5 h-5" />,
  },
  SCAN: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    icon: <Search className="w-5 h-5" />,
  },
};

// =============================================================================
// VERDICT CARD — floating overlay
// =============================================================================

function VerdictCard({
  verdict,
  onDismiss,
}: {
  verdict: HuntVerdict;
  onDismiss: () => void;
}) {
  const style = VERDICT_STYLES[verdict.verdict] || VERDICT_STYLES.SCAN;
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setOpacity(1));
    // Auto-dismiss
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(onDismiss, 300);
    }, VERDICT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-xl p-3 backdrop-blur-md shadow-2xl transition-opacity duration-300 cursor-pointer`}
      style={{ opacity }}
      onClick={onDismiss}
    >
      {/* Verdict header */}
      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-2 ${style.text} font-bold text-lg`}>
          {style.icon}
          <span>{verdict.verdict}</span>
        </div>
        <span className="text-xs text-white/40">{verdict.responseTime}ms</span>
      </div>

      {/* Item name */}
      <div className="text-white font-medium text-sm truncate">
        {verdict.itemName}
      </div>

      {/* Value + reason */}
      {verdict.estimatedValue.display !== 'Unknown' && (
        <div className={`${style.text} text-sm font-semibold mt-1`}>
          {verdict.estimatedValue.display}
        </div>
      )}
      <div className="text-white/70 text-xs mt-1 line-clamp-2">
        {verdict.reason}
      </div>

      {/* Confidence bar */}
      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            verdict.confidence > 0.7
              ? 'bg-emerald-500'
              : verdict.confidence > 0.4
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${verdict.confidence * 100}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// SESSION STATS BAR
// =============================================================================

function SessionStatsBar({ stats }: { stats: SessionStats }) {
  const elapsed = Math.floor((Date.now() - stats.startedAt) / 60000);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg text-xs">
      <div className="flex items-center gap-1 text-white/60">
        <Eye className="w-3 h-3" />
        <span>{stats.scansTotal}</span>
      </div>
      <div className="flex items-center gap-1 text-emerald-400">
        <ShoppingCart className="w-3 h-3" />
        <span>{stats.buys}</span>
      </div>
      {stats.totalEstimatedValue > 0 && (
        <div className="flex items-center gap-1 text-amber-400">
          <TrendingUp className="w-3 h-3" />
          <span>${stats.totalEstimatedValue}</span>
        </div>
      )}
      <div className="text-white/40 ml-auto">{elapsed}m</div>
    </div>
  );
}

// =============================================================================
// HUNT PAGE COMPONENT
// =============================================================================

export default function HuntPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  // — Verdict overlay state
  const [verdicts, setVerdicts] = useState<HuntVerdict[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // — Session stats
  const [stats, setStats] = useState<SessionStats>({
    scansTotal: 0,
    buys: 0,
    skips: 0,
    holds: 0,
    totalEstimatedValue: 0,
    startedAt: Date.now(),
  });

  // — Throttle ref
  const lastHuntRef = useRef<number>(0);
  const huntInFlightRef = useRef(false);

  // — Remove verdict by id
  const dismissVerdict = useCallback((id: string) => {
    setVerdicts((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // — Main capture handler: glasses frame → /api/oracle/hunt → verdict
  const handleCaptureItem = useCallback(
    async (imageBase64: string) => {
      // Throttle: skip if too soon or already in flight
      const now = Date.now();
      if (now - lastHuntRef.current < HUNT_THROTTLE_MS) return;
      if (huntInFlightRef.current) return;
      if (!session?.access_token) return;

      lastHuntRef.current = now;
      huntInFlightRef.current = true;
      setIsAnalyzing(true);

      try {
        const response = await fetch('/api/oracle/hunt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            image: imageBase64,
            deviceType: 'glasses',
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            toast.error('Hunt limit reached — upgrade for more scans');
            return;
          }
          throw new Error(`Hunt failed: ${response.status}`);
        }

        const data = await response.json();

        // Build verdict object
        const verdict: HuntVerdict = {
          verdict: data.verdict || 'SCAN',
          itemName: data.itemName || 'Unknown',
          estimatedValue: data.estimatedValue || { low: 0, high: 0, display: 'Unknown' },
          reason: data.reason || 'Processing...',
          category: data.category || 'general',
          confidence: data.confidence || 0,
          responseTime: data.responseTime || 0,
          provider: data.provider || 'unknown',
          timestamp: Date.now(),
          id: `hunt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };

        // Add to verdict stack (cap at MAX_VERDICT_STACK)
        setVerdicts((prev) => [...prev.slice(-(MAX_VERDICT_STACK - 1)), verdict]);

        // Update session stats
        setStats((prev) => ({
          ...prev,
          scansTotal: prev.scansTotal + 1,
          buys: prev.buys + (verdict.verdict === 'BUY' ? 1 : 0),
          skips: prev.skips + (verdict.verdict === 'SKIP' ? 1 : 0),
          holds: prev.holds + (verdict.verdict === 'HOLD' ? 1 : 0),
          totalEstimatedValue:
            prev.totalEstimatedValue +
            (verdict.verdict === 'BUY' ? verdict.estimatedValue.high || 0 : 0),
        }));

        // Toast for BUY verdicts (exciting!)
        if (verdict.verdict === 'BUY') {
          toast.success(`🎯 ${verdict.itemName} — ${verdict.estimatedValue.display}`, {
            description: verdict.reason,
          });
        }
      } catch (err: any) {
        console.error('Hunt error:', err.message);
        // Don't toast on every throttled error — just log
      } finally {
        huntInFlightRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [session]
  );

  // — Batch handler: multiple frames from sweep
  const handleBatchCapture = useCallback(
    async (images: string[]) => {
      if (!session?.access_token || images.length === 0) return;

      setIsAnalyzing(true);
      try {
        const response = await fetch('/api/oracle/hunt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            images,
            deviceType: 'glasses',
          }),
        });

        if (!response.ok) throw new Error(`Batch hunt failed: ${response.status}`);

        const data = await response.json();

        if (data.results && Array.isArray(data.results)) {
          const newVerdicts: HuntVerdict[] = data.results.map((r: any, i: number) => ({
            verdict: r.verdict || 'SCAN',
            itemName: r.itemName || `Item ${i + 1}`,
            estimatedValue: r.estimatedValue || { low: 0, high: 0, display: 'Unknown' },
            reason: r.reason || '',
            category: r.category || 'general',
            confidence: r.confidence || 0,
            responseTime: r.responseTime || 0,
            provider: r.provider || 'unknown',
            timestamp: Date.now() + i * 100,
            id: `batch-${Date.now()}-${i}`,
          }));

          setVerdicts((prev) => [...prev, ...newVerdicts].slice(-MAX_VERDICT_STACK));

          const buys = newVerdicts.filter((v) => v.verdict === 'BUY');
          if (buys.length > 0) {
            toast.success(`🎯 ${buys.length} finds in batch!`, {
              description: buys.map((b) => b.itemName).join(', '),
            });
          } else {
            toast.info(`Scanned ${newVerdicts.length} items — nothing jumped out`);
          }

          // Update stats
          setStats((prev) => ({
            ...prev,
            scansTotal: prev.scansTotal + newVerdicts.length,
            buys: prev.buys + buys.length,
            skips: prev.skips + newVerdicts.filter((v) => v.verdict === 'SKIP').length,
            holds: prev.holds + newVerdicts.filter((v) => v.verdict === 'HOLD').length,
            totalEstimatedValue:
              prev.totalEstimatedValue +
              buys.reduce((sum, b) => sum + (b.estimatedValue.high || 0), 0),
          }));
        }
      } catch (err: any) {
        toast.error('Batch analysis failed');
        console.error('Batch hunt error:', err.message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [session]
  );

  return (
    <div className="relative min-h-screen bg-gray-950">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-50 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Hunt mode indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-amber-500/30">
        <Zap className={`w-4 h-4 ${isAnalyzing ? 'text-amber-400 animate-pulse' : 'text-amber-500/60'}`} />
        <span className="text-xs font-medium text-amber-400/90">
          {isAnalyzing ? 'Analyzing...' : 'Hunt Mode'}
        </span>
      </div>

      {/* Session stats */}
      {stats.scansTotal > 0 && (
        <div className="absolute top-4 right-4 z-50">
          <SessionStatsBar stats={stats} />
        </div>
      )}

      {/* Verdict overlay — floating cards */}
      <div className="absolute bottom-32 left-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
        {verdicts.map((v) => (
          <div key={v.id} className="pointer-events-auto">
            <VerdictCard verdict={v} onDismiss={() => dismissVerdict(v.id)} />
          </div>
        ))}
      </div>

      {/* SmartGlassesControl — now wired to hunt pipeline */}
      <SmartGlassesControl
        onCaptureItem={handleCaptureItem}
        onBatchCapture={handleBatchCapture}
      />
    </div>
  );
}
// FILE: src/components/history/ScanHistoryTimeline.tsx
// RH-020 — Item History Layer
// Displays a user's scan history with price trend indicators.
// Fetches from GET /api/scan-history?userId=xxx
//
// Usage:
//   import ScanHistoryTimeline from '@/components/history/ScanHistoryTimeline';
//   <ScanHistoryTimeline userId={user.id} />

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface ScanEntry {
  analysisId: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  totalVotes: number;
  scannedAt: string;
  valueDelta?: number;
  valueDeltaPct?: number;
  priceDirection?: 'up' | 'down' | 'flat' | 'first_scan';
}

interface ScanHistorySummary {
  totalScans: number;
  uniqueItems: number;
  mostRecent: string | null;
  avgConfidence: number;
}

interface ScanHistoryTimelineProps {
  userId: string;
  limit?: number;
  onSelectScan?: (analysisId: string, itemName: string) => void;
  className?: string;
}

const DIRECTION_CONFIG = {
  up:         { icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-500/20' },
  down:       { icon: TrendingDown, color: 'text-red-400',     bg: 'bg-red-950/40 border-red-500/20' },
  flat:       { icon: Minus,        color: 'text-white/40',    bg: 'bg-white/5 border-white/10' },
  first_scan: { icon: Clock,        color: 'text-blue-400',    bg: 'bg-blue-950/30 border-blue-500/20' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatValue(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

const ScanHistoryTimeline: React.FC<ScanHistoryTimelineProps> = ({
  userId,
  limit = 20,
  onSelectScan,
  className = '',
}) => {
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [summary, setSummary] = useState<ScanHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/scan-history?userId=${encodeURIComponent(userId)}&limit=${limit}&mode=timeline`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setScans(data.scans || []);
        setSummary(data.summary || null);
      }
    } catch (err: any) {
      setError('Could not load scan history');
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-400 text-sm ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
        <button onClick={fetchHistory} className="ml-auto text-white/40 hover:text-white/70">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!scans.length) {
    return (
      <div className={`text-center py-8 text-white/40 text-sm ${className}`}>
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No scans yet</p>
        <p className="text-xs mt-1">Your scan history will appear here</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>

      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-4 px-1 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{summary.totalScans}</p>
            <p className="text-xs text-white/40">Scans</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-white">{summary.uniqueItems}</p>
            <p className="text-xs text-white/40">Items</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-white">{summary.avgConfidence}%</p>
            <p className="text-xs text-white/40">Avg confidence</p>
          </div>
          <button
            onClick={fetchHistory}
            className="ml-auto text-white/30 hover:text-white/60 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scan entries */}
      {scans.map((scan) => {
        const dir = scan.priceDirection || 'first_scan';
        const dirConfig = DIRECTION_CONFIG[dir];
        const Icon = dirConfig.icon;

        return (
          <button
            key={scan.analysisId}
            onClick={() => onSelectScan?.(scan.analysisId, scan.itemName)}
            className={`
              w-full flex items-center gap-3 px-4 py-3
              rounded-xl border text-left
              ${dirConfig.bg}
              transition-all active:scale-[0.99]
              ${onSelectScan ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
            `}
          >
            {/* Direction icon */}
            <div className={`shrink-0 ${dirConfig.color}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Item info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {scan.itemName}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                {formatDate(scan.scannedAt)}
                {scan.totalVotes > 0 && ` · ${scan.totalVotes} AI votes`}
              </p>
            </div>

            {/* Value + delta */}
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-white">
                {formatValue(scan.estimatedValue)}
              </p>
              {scan.valueDelta !== undefined && scan.priceDirection !== 'first_scan' && (
                <p className={`text-xs mt-0.5 ${
                  scan.valueDelta > 0 ? 'text-emerald-400'
                  : scan.valueDelta < 0 ? 'text-red-400'
                  : 'text-white/40'
                }`}>
                  {scan.valueDelta > 0 ? '+' : ''}
                  {formatValue(scan.valueDelta)}
                  {scan.valueDeltaPct !== undefined && ` (${scan.valueDeltaPct > 0 ? '+' : ''}${scan.valueDeltaPct.toFixed(1)}%)`}
                </p>
              )}
              {scan.priceDirection === 'first_scan' && (
                <p className="text-xs text-white/30 mt-0.5">First scan</p>
              )}
            </div>

            {/* Decision badge */}
            <div className={`
              shrink-0 px-2 py-0.5 rounded-full text-xs font-medium
              ${scan.decision === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              }
            `}>
              {scan.decision}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ScanHistoryTimeline;
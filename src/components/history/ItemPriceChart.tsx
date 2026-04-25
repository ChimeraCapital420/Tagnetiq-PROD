// FILE: src/components/history/ItemPriceChart.tsx
// RH-020 — Price History Chart for a specific item
// Shows price over time for repeated scans of the same item.
// Fetches from GET /api/scan-history?mode=item-history&itemName=xxx
//
// Usage:
//   <ItemPriceChart userId={user.id} itemName="1890 Morgan Dollar" />

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface PricePoint {
  date: string;
  value: number;
  confidence: number;
}

interface ItemPriceHistory {
  itemName: string;
  scanCount: number;
  firstScanned: string;
  lastScanned: string;
  currentValue: number;
  peakValue: number;
  lowestValue: number;
  avgValue: number;
  priceHistory: PricePoint[];
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
}

interface ItemPriceChartProps {
  userId: string;
  itemName: string;
  className?: string;
}

const TREND_CONFIG = {
  rising:   { icon: TrendingUp,   color: 'text-emerald-400', label: 'Rising' },
  falling:  { icon: TrendingDown, color: 'text-red-400',     label: 'Falling' },
  stable:   { icon: Minus,        color: 'text-blue-400',    label: 'Stable' },
  volatile: { icon: TrendingUp,   color: 'text-amber-400',   label: 'Volatile' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ItemPriceChart: React.FC<ItemPriceChartProps> = ({
  userId,
  itemName,
  className = '',
}) => {
  const [history, setHistory] = useState<ItemPriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scan-history?userId=${encodeURIComponent(userId)}&itemName=${encodeURIComponent(itemName)}&mode=item-history`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(data.itemHistory || null);
    } catch (err: any) {
      setError('Could not load price history');
    } finally {
      setLoading(false);
    }
  }, [userId, itemName]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <div className={`h-32 rounded-xl bg-white/5 animate-pulse ${className}`} />;
  if (error) return (
    <div className={`flex items-center gap-2 text-red-400 text-sm ${className}`}>
      <AlertCircle className="w-4 h-4" />
      <span>{error}</span>
    </div>
  );
  if (!history || history.scanCount < 2) return null;

  const { priceHistory, trend } = history;
  const trendConfig = TREND_CONFIG[trend];
  const TrendIcon = trendConfig.icon;

  // Normalize values for SVG chart (0–100 range)
  const values = priceHistory.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const normalize = (v: number) => 100 - ((v - minVal) / range) * 80; // 80% of height used

  const chartWidth = 280;
  const chartHeight = 80;
  const stepX = priceHistory.length > 1 ? chartWidth / (priceHistory.length - 1) : chartWidth;

  const points = priceHistory.map((p, i) => ({
    x: i * stepX,
    y: (normalize(p.value) / 100) * chartHeight,
    ...p,
  }));

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  ).join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${chartHeight} L 0 ${chartHeight} Z`;

  const lineColor = trend === 'rising' ? '#34d399'
    : trend === 'falling' ? '#f87171'
    : trend === 'volatile' ? '#fbbf24'
    : '#60a5fa';

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-sm font-semibold text-white truncate max-w-[200px]">
            {history.itemName}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            {history.scanCount} scans · {formatDate(history.firstScanned)} – {formatDate(history.lastScanned)}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendConfig.color}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendConfig.label}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="px-4 pb-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ height: 80 }}
        >
          {/* Area fill */}
          <path d={areaD} fill={lineColor} fillOpacity="0.08" />
          {/* Line */}
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={lineColor} opacity="0.9" />
          ))}
        </svg>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 border-t border-white/10 divide-x divide-white/10">
        {[
          { label: 'Current', value: `$${history.currentValue.toFixed(0)}` },
          { label: 'Peak',    value: `$${history.peakValue.toFixed(0)}` },
          { label: 'Low',     value: `$${history.lowestValue.toFixed(0)}` },
          { label: 'Avg',     value: `$${history.avgValue.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="text-center py-2.5 px-1">
            <p className="text-xs font-semibold text-white">{value}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ItemPriceChart;
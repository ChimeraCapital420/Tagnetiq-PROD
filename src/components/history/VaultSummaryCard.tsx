// FILE: src/components/history/VaultSummaryCard.tsx
// RH-020 — Vault Summary — total value of all scanned items
// Fetches from GET /api/scan-history?mode=vault-summary
//
// Usage:
//   <VaultSummaryCard userId={user.id} />

import React, { useState, useEffect, useCallback } from 'react';
import { Archive, TrendingUp, RefreshCw } from 'lucide-react';

interface VaultItem {
  itemName: string;
  currentValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  lastScanned: string;
}

interface VaultSummary {
  totalItems: number;
  totalValue: number;
  items: VaultItem[];
}

interface VaultSummaryCardProps {
  userId: string;
  onItemSelect?: (itemName: string) => void;
  className?: string;
}

const VaultSummaryCard: React.FC<VaultSummaryCardProps> = ({
  userId,
  onItemSelect,
  className = '',
}) => {
  const [summary, setSummary] = useState<VaultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const fetch$ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/scan-history?userId=${encodeURIComponent(userId)}&mode=vault-summary`
      );
      const data = await res.json();
      if (data.success) setSummary(data.vaultSummary);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch$(); }, [fetch$]);

  if (loading) return <div className={`h-24 rounded-xl bg-white/5 animate-pulse ${className}`} />;
  if (!summary || summary.totalItems === 0) return null;

  const displayItems = showAll ? summary.items : summary.items.slice(0, 5);

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Archive className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Scan Vault</p>
          <p className="text-xs text-white/40">{summary.totalItems} unique items scanned</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">
            ${summary.totalValue >= 1000
              ? `${(summary.totalValue / 1000).toFixed(1)}k`
              : summary.totalValue.toFixed(0)
            }
          </p>
          <p className="text-xs text-white/40">Total value</p>
        </div>
        <button onClick={fetch$} className="text-white/30 hover:text-white/60 ml-1">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items */}
      <div className="divide-y divide-white/5">
        {displayItems.map((item) => (
          <button
            key={item.itemName}
            onClick={() => onItemSelect?.(item.itemName)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{item.itemName}</p>
            </div>
            <p className="text-xs text-white/70 shrink-0">
              ${item.currentValue.toFixed(0)}
            </p>
            <span className={`
              text-[10px] px-1.5 py-0.5 rounded-full shrink-0
              ${item.decision === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-orange-500/20 text-orange-300'
              }
            `}>
              {item.decision}
            </span>
          </button>
        ))}
      </div>

      {/* Show more */}
      {summary.items.length > 5 && (
        <button
          onClick={() => setShowAll(p => !p)}
          className="w-full py-2.5 text-xs text-white/40 hover:text-white/70 border-t border-white/10 transition-colors"
        >
          {showAll ? 'Show less' : `Show ${summary.items.length - 5} more`}
        </button>
      )}
    </div>
  );
};

export default VaultSummaryCard;
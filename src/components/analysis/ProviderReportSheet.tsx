// FILE: src/components/analysis/ProviderReportSheet.tsx
// v1.0 — Tappable Provider Report Card (Slide-up Bottom Sheet)
// Mobile-first. Thumb zone. Dark theme. Zero new dependencies.
//
// Shows the FULL reasoning from a single AI provider:
//   - What it identified the item as
//   - Its valuation and confidence
//   - Valuation factors / reasoning
//   - Where it agrees/disagrees with consensus
//   - Response time
//
// Reads rawResponse from the vote object (preserved through pipeline).
// Writes to sessionStorage for Oracle awareness (Step 2 bridge).
// Admin-only "Flag for Review" button for benchmark ingestion.

import React, { useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown, Clock, TrendingUp, TrendingDown, Minus, Flag } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderVote {
  providerName: string;
  icon: string;
  color: string;
  success: boolean;
  weight: number;
  responseTime: number;
  estimatedValue: number;
  decision: string;
  confidence: number;
  itemName?: string;
  category?: string;
  rawResponse?: any;
}

export interface ConsensusContext {
  estimatedValue: number;
  decision: string;
  confidence: number;
  itemName: string;
}

interface ProviderReportSheetProps {
  vote: ProviderVote;
  consensus: ConsensusContext;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeConfidenceDisplay(raw: number): number {
  if (raw > 1) return raw;
  return Math.round(raw * 100);
}

function getDecisionBadge(decision: string) {
  const d = (decision || 'SELL').toUpperCase();
  switch (d) {
    case 'BUY':
      return { label: 'BUY', bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: TrendingUp };
    case 'HOLD':
      return { label: 'HOLD', bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Minus };
    default:
      return { label: 'SELL', bg: 'bg-red-500/20', text: 'text-red-400', icon: TrendingDown };
  }
}

function getPriceDelta(providerValue: number, consensusValue: number): {
  label: string;
  color: string;
  percent: string;
} {
  if (!consensusValue || !providerValue) {
    return { label: 'N/A', color: 'text-white/40', percent: '' };
  }
  const diff = providerValue - consensusValue;
  const pct = ((diff / consensusValue) * 100).toFixed(1);
  if (Math.abs(diff) < 0.01) {
    return { label: 'Matches consensus', color: 'text-emerald-400', percent: '0%' };
  }
  if (diff > 0) {
    return { label: `+$${diff.toFixed(2)} above`, color: 'text-yellow-400', percent: `+${pct}%` };
  }
  return { label: `-$${Math.abs(diff).toFixed(2)} below`, color: 'text-blue-400', percent: `${pct}%` };
}

function extractValuationFactors(rawResponse: any): string[] {
  if (!rawResponse) return [];
  const factors = rawResponse.valuation_factors || rawResponse.valuationFactors || [];
  if (Array.isArray(factors)) return factors.filter((f: any) => typeof f === 'string' && f.trim());
  return [];
}

function extractReasoning(rawResponse: any): string {
  if (!rawResponse) return '';
  return rawResponse.summary_reasoning || rawResponse.reasoning || rawResponse.summaryReasoning || '';
}

// =============================================================================
// ORACLE CONTEXT EVENT (sessionStorage bridge for Step 2)
// =============================================================================

function writeOracleContextEvent(vote: ProviderVote, consensus: ConsensusContext) {
  try {
    sessionStorage.setItem('oracle_context_event', JSON.stringify({
      type: 'provider_report_opened',
      provider: vote.providerName,
      itemName: consensus.itemName,
      providerValue: vote.estimatedValue,
      consensusValue: consensus.estimatedValue,
      providerDecision: vote.decision,
      consensusDecision: consensus.decision,
      timestamp: Date.now(),
    }));
  } catch {
    // sessionStorage might be full or unavailable — degrade silently
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

const ProviderReportSheet: React.FC<ProviderReportSheetProps> = ({
  vote,
  consensus,
  isOpen,
  onClose,
  isAdmin = false,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef(false);

  // ── Write Oracle context event when sheet opens ──
  useEffect(() => {
    if (isOpen && vote && consensus) {
      writeOracleContextEvent(vote, consensus);
    }
  }, [isOpen, vote, consensus]);

  // ── Close on Escape ──
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Swipe-down to close (mobile) ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 100) {
      onClose();
    }
    sheetRef.current.style.transform = '';
  }, [onClose]);

  // ── Admin flag handler ──
  const handleFlag = useCallback(() => {
    try {
      const existing = JSON.parse(sessionStorage.getItem('flagged_providers') || '[]');
      existing.push({
        provider: vote.providerName,
        itemName: consensus.itemName,
        providerValue: vote.estimatedValue,
        consensusValue: consensus.estimatedValue,
        timestamp: Date.now(),
      });
      sessionStorage.setItem('flagged_providers', JSON.stringify(existing));
    } catch {
      // silent
    }
  }, [vote, consensus]);

  if (!isOpen || !vote) return null;

  const decisionBadge = getDecisionBadge(vote.decision);
  const DecisionIcon = decisionBadge.icon;
  const priceDelta = getPriceDelta(vote.estimatedValue, consensus.estimatedValue);
  const factors = extractValuationFactors(vote.rawResponse);
  const reasoning = extractReasoning(vote.rawResponse);
  const confDisplay = normalizeConfidenceDisplay(vote.confidence);
  const consensusConfDisplay = normalizeConfidenceDisplay(consensus.confidence);
  const decisionsMatch = (vote.decision || '').toUpperCase() === (consensus.decision || '').toUpperCase();

  // Confidence bar position (0-100)
  const confBarWidth = Math.min(100, Math.max(0, confDisplay));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0a0a0f] shadow-2xl transition-transform duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={`${vote.providerName} report`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{vote.icon || '🤖'}</span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">
                {vote.providerName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Clock className="w-3 h-3" />
                <span>{(vote.responseTime / 1000).toFixed(1)}s</span>
                <span className="text-white/20">•</span>
                <span>Weight: {vote.weight.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-8 space-y-5">

          {/* ── Price + Decision Row ── */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
            <div>
              <p className="text-xs text-white/50 mb-1">Provider Estimate</p>
              <p className="text-2xl font-bold text-white">
                ${vote.estimatedValue > 0 ? vote.estimatedValue.toFixed(2) : '—'}
              </p>
              <p className={`text-xs mt-1 ${priceDelta.color}`}>
                {priceDelta.label} {priceDelta.percent && `(${priceDelta.percent})`}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${decisionBadge.bg} ${decisionBadge.text}`}>
                <DecisionIcon className="w-4 h-4" />
                {decisionBadge.label}
              </span>
            </div>
          </div>

          {/* ── Confidence Bar ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Provider Confidence</span>
              <span className="text-white/80 font-medium">{confDisplay}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${confBarWidth}%`,
                  backgroundColor: vote.color || '#888',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Consensus: {consensusConfDisplay}%</span>
              <span>{confDisplay > consensusConfDisplay ? 'Above' : confDisplay < consensusConfDisplay ? 'Below' : 'Matches'} consensus</span>
            </div>
          </div>

          {/* ── Agreement Indicators ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border p-3 ${decisionsMatch ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
              <p className="text-xs text-white/50 mb-1">Decision</p>
              <p className={`text-sm font-medium ${decisionsMatch ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {decisionsMatch ? '✓ Agrees' : '✗ Disagrees'}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {decisionsMatch
                  ? `Both say ${vote.decision}`
                  : `Says ${vote.decision}, consensus ${consensus.decision}`}
              </p>
            </div>
            <div className={`rounded-xl border p-3 ${Math.abs(priceDelta.percent ? parseFloat(priceDelta.percent) : 0) < 20 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
              <p className="text-xs text-white/50 mb-1">Value</p>
              <p className={`text-sm font-medium ${Math.abs(priceDelta.percent ? parseFloat(priceDelta.percent) : 0) < 20 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {Math.abs(priceDelta.percent ? parseFloat(priceDelta.percent) : 0) < 20 ? '✓ Close' : '⚠ Outlier'}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {priceDelta.percent || 'N/A'} from consensus
              </p>
            </div>
          </div>

          {/* ── Item Identified ── */}
          {(vote.itemName || vote.rawResponse?.itemName) && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50 mb-1">Item Identified</p>
              <p className="text-sm text-white/90">
                {vote.itemName || vote.rawResponse?.itemName || 'Unknown'}
              </p>
              {vote.category && (
                <p className="text-xs text-white/40 mt-1">
                  Category: {vote.category.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}

          {/* ── Reasoning ── */}
          {reasoning && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50 mb-2">Reasoning</p>
              <p className="text-sm text-white/80 leading-relaxed">{reasoning}</p>
            </div>
          )}

          {/* ── Valuation Factors ── */}
          {factors.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50 mb-2">Valuation Factors</p>
              <div className="space-y-1.5">
                {factors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="text-white/30 mt-0.5 flex-shrink-0">•</span>
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Raw Response Details (if extra fields exist) ── */}
          {vote.rawResponse?.marketAssessment && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50 mb-2">Market Assessment</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {vote.rawResponse.marketAssessment.trend && (
                  <div>
                    <p className="text-xs text-white/40">Trend</p>
                    <p className="text-white/80 capitalize">
                      {vote.rawResponse.marketAssessment.trend}
                    </p>
                  </div>
                )}
                {vote.rawResponse.marketAssessment.demandLevel && (
                  <div>
                    <p className="text-xs text-white/40">Demand</p>
                    <p className="text-white/80 capitalize">
                      {vote.rawResponse.marketAssessment.demandLevel}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Admin: Flag for Review ── */}
          {isAdmin && (
            <button
              onClick={handleFlag}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 active:bg-orange-500/10 transition-colors min-h-[44px]"
            >
              <Flag className="w-4 h-4" />
              <span className="text-sm">Flag for Review</span>
            </button>
          )}

          {/* Bottom safe area spacer for mobile */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
};

export default ProviderReportSheet;
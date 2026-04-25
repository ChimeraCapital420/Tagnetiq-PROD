// FILE: src/components/analysis/LuxuryAuthBadge.tsx
// RH-032 — Luxury Authentication Badge
// Appears on scan result cards when a luxury brand is detected.
// Data comes from analyze.ts → luxuryAuthentication block.
//
// Usage:
//   import LuxuryAuthBadge from '@/components/analysis/LuxuryAuthBadge';
//   <LuxuryAuthBadge auth={scanResult.luxuryAuthentication} />

import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Smartphone, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface NfcGuidance {
  hasChip: boolean;
  chipSince?: number;
  scanInstruction?: string;
  doubleTestApplies?: boolean;
  doubleTestExplain?: string;
  alternateCheck?: string;
}

interface LuxuryAuth {
  isLuxury: boolean;
  brandName: string;
  category: string;
  priceRange: string;
  authenticationRequired: boolean;
  nfcCapable: boolean;
  nfcSince?: number | null;
  authPrompt: string;
  authUrgency: 'high' | 'medium';
  resalePlatforms: string[];
  nfcGuidance: NfcGuidance;
}

interface LuxuryAuthBadgeProps {
  auth: LuxuryAuth | null;
  onAuthenticateTap?: () => void;
  className?: string;
}

const URGENCY_STYLES = {
  high:   'border-amber-500/40 bg-amber-950/30',
  medium: 'border-blue-500/30 bg-blue-950/20',
};

const PLATFORM_LABELS: Record<string, string> = {
  realreal:  'The RealReal',
  vestiaire: 'Vestiaire',
  grailed:   'Grailed',
  depop:     'Depop',
  poshmark:  'Poshmark',
  stockx:    'StockX',
  goat:      'GOAT',
  ebay:      'eBay',
};

const LuxuryAuthBadge: React.FC<LuxuryAuthBadgeProps> = ({
  auth,
  onAuthenticateTap,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!auth?.isLuxury) return null;

  const { nfcGuidance } = auth;

  return (
    <div className={`rounded-xl border ${URGENCY_STYLES[auth.authUrgency]} overflow-hidden ${className}`}>

      {/* ── Header row ────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="shrink-0">
          {auth.nfcCapable
            ? <Shield className="w-5 h-5 text-amber-400" />
            : <ShieldAlert className="w-5 h-5 text-blue-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            {auth.brandName} Detected
          </p>
          <p className="text-xs text-white/60 mt-0.5 leading-snug">
            {auth.authPrompt}
          </p>
        </div>

        <button
          onClick={() => setExpanded(p => !p)}
          className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-1"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
        </button>
      </div>

      {/* ── Authenticate button ───────────────────────────── */}
      <div className="px-4 pb-3">
        <button
          onClick={onAuthenticateTap}
          className={`
            w-full flex items-center justify-center gap-2
            py-2.5 rounded-lg text-sm font-medium
            transition-all active:scale-[0.98]
            ${auth.authUrgency === 'high'
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
          `}
        >
          <ShieldCheck className="w-4 h-4" />
          Authenticate This Item
        </button>
      </div>

      {/* ── Expanded details ──────────────────────────────── */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3">

          {/* NFC status */}
          <div className="flex items-start gap-2.5">
            <Smartphone className={`w-4 h-4 mt-0.5 shrink-0 ${nfcGuidance.hasChip ? 'text-emerald-400' : 'text-white/30'}`} />
            <div>
              <p className="text-xs font-medium text-white/80">
                {nfcGuidance.hasChip
                  ? `NFC chip embedded${auth.nfcSince ? ` since ${auth.nfcSince}` : ''}`
                  : 'No NFC chip — visual authentication only'
                }
              </p>
              <p className="text-xs text-white/50 mt-0.5 leading-snug">
                {nfcGuidance.hasChip
                  ? nfcGuidance.scanInstruction
                  : nfcGuidance.alternateCheck
                }
              </p>
            </div>
          </div>

          {/* Double scan test */}
          {nfcGuidance.hasChip && nfcGuidance.doubleTestApplies && (
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <p className="text-xs font-medium text-amber-300 mb-0.5">Double-Scan Test</p>
              <p className="text-xs text-white/55 leading-snug">
                {nfcGuidance.doubleTestExplain}
              </p>
            </div>
          )}

          {/* Resale platforms */}
          {auth.resalePlatforms.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Best resale platforms for this brand</p>
              <div className="flex flex-wrap gap-1.5">
                {auth.resalePlatforms.slice(0, 4).map(p => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10"
                  >
                    {PLATFORM_LABELS[p] || p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LuxuryAuthBadge;
// FILE: src/components/listing/WhatnotListingCard.tsx
// RH-024 — Whatnot Listing Builder UI
// Displays the generated Whatnot listing with copy buttons.
// Wire into scan result action hub or dedicated listing flow.
//
// Usage:
//   <WhatnotListingCard
//     itemName={result.itemName}
//     estimatedValue={result.estimatedValue}
//     category={result.category}
//     condition={result.condition}
//     votes={result.hydraConsensus?.votes}
//   />

import React, { useState, useCallback } from 'react';
import { Zap, Copy, Check, ExternalLink, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';

interface PriceGuidance {
  hydraConsensus: number;
  suggestedStart: number;
  suggestedBIN: number;
  note?: string;
}

interface WhatnotListing {
  title: string;
  openingLine: string;
  description: string;
  conditionNotes: string;
  hashtags: string[];
  startingPrice: number;
  binPrice: number;
  whatnotCategory: string;
  priceGuidance: PriceGuidance;
}

interface WhatnotListingCardProps {
  itemName: string;
  estimatedValue: number;
  category?: string;
  condition?: string;
  votes?: any[];
  className?: string;
}

function useCopy(timeout = 2000) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), timeout);
    }).catch(() => {});
  }, [timeout]);
  return { copied, copy };
}

const WhatnotListingCard: React.FC<WhatnotListingCardProps> = ({
  itemName,
  estimatedValue,
  category = 'general',
  condition = 'good',
  votes = [],
  className = '',
}) => {
  const [listing, setListing] = useState<WhatnotListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { copied, copy } = useCopy();

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatnot-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, estimatedValue, category, condition, votes }),
      });
      const data = await res.json();
      if (data.success) setListing(data.listing);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [itemName, estimatedValue, category, condition, votes]);

  const CopyBtn = ({ text, id, label }: { text: string; id: string; label?: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/5"
    >
      {copied === id
        ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
        : <><Copy className="w-3 h-3" /><span>{label || 'Copy'}</span></>
      }
    </button>
  );

  if (!listing) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">List on Whatnot</p>
            <p className="text-xs text-white/40">AI-generated listing in seconds</p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
            : <><Zap className="w-4 h-4" />Generate Whatnot Listing</>
          }
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-orange-500/20 bg-orange-950/20 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Zap className="w-4 h-4 text-orange-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Whatnot Listing Ready</p>
          <p className="text-xs text-white/40">{listing.whatnotCategory} · Start at ${listing.startingPrice}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {expanded && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {/* Title */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Title</p>
              <CopyBtn text={listing.title} id="title" />
            </div>
            <p className="text-sm text-white font-medium">{listing.title}</p>
          </div>

          {/* Opening line */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Live Opening Line</p>
              <CopyBtn text={listing.openingLine} id="opening" />
            </div>
            <p className="text-sm text-white/80 italic">"{listing.openingLine}"</p>
          </div>

          {/* Description */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Description</p>
              <CopyBtn text={listing.description} id="desc" />
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{listing.description}</p>
          </div>

          {/* Condition notes */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Condition Notes</p>
              <CopyBtn text={listing.conditionNotes} id="condition" />
            </div>
            <p className="text-sm text-white/70">{listing.conditionNotes}</p>
          </div>

          {/* Hashtags */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Hashtags</p>
              <CopyBtn text={listing.hashtags.map(h => `#${h}`).join(' ')} id="tags" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {listing.hashtags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="px-4 py-3 bg-white/5">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Pricing</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Start Bid', value: listing.startingPrice, color: 'text-emerald-400' },
                { label: 'BIN Price', value: listing.binPrice, color: 'text-blue-400' },
                { label: 'HYDRA Value', value: estimatedValue, color: 'text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-base font-bold ${color}`}>${value}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {listing.priceGuidance.note && (
              <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
                {listing.priceGuidance.note}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="px-4 py-3">
            <button
              onClick={() => copy(
                `${listing.title}\n\n${listing.description}\n\n${listing.conditionNotes}\n\n${listing.hashtags.map(h => `#${h}`).join(' ')}`,
                'all'
              )}
              className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2"
            >
              {copied === 'all'
                ? <><Check className="w-4 h-4" />Copied Full Listing!</>
                : <><Copy className="w-4 h-4" />Copy Full Listing</>
              }
            </button>
            <a
              href="https://www.whatnot.com/sell"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open Whatnot to List
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatnotListingCard;
// FILE: src/components/analysis/components/ActionHub.tsx
// Fallback ACTION HUB — shown when Nexus data is not available or dismissed.
//
// v1.0: AddToVault, ListOnMarketplace, Share, Clear, Delete
// v1.1: RH-009 + RH-024 + RH-016/017/018 + RH-023 wired:
//   - "Add to Inventory" — one-tap from scan result into ERP (RH-009)
//   - "List on Whatnot" — opens WhatnotListingCard inline (RH-024)
//   - "Care & Maintenance" — Product Ownership Hub for any item (RH-023)
//   - Domain-specific buttons based on detected category:
//       auto/parts → "Identify This Part" (RH-017)
//       art/painting → "Authenticate Artwork" (RH-018)
//       medication/pills → "Identify Medication" (RH-016)
//   - "Meditation" quick link → /wellness (RH-042)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trash2, Package, Zap, Wrench, Palette, Pill, Heart, ShoppingBag, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AddToVaultButton } from '@/components/vault/AddToVaultButton.js';
import { ListOnMarketplaceButton } from '@/components/marketplace/ListOnMarketplaceButton.js';
import WhatnotListingCard from '@/components/listing/WhatnotListingCard.js';
import type { MarketplaceItem } from '@/components/marketplace/platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';

interface ActionHubProps {
  analysisResult: any;
  marketplaceItem: MarketplaceItem;
  ghostData: GhostData | null;
  isViewingHistory: boolean;
  onClear: () => void;
  onDeleteFromHistory: () => void;
  onListOnTagnetiq: (
    item: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData,
  ) => Promise<void>;
}

// ─── Category detection helpers ───────────────────────────────────────────────

function detectDomainCategory(category: string, itemName: string): 'auto' | 'art' | 'medication' | null {
  const lower = `${category} ${itemName}`.toLowerCase();

  if (/\b(auto|car|truck|vehicle|part|oem|engine|transmission|brake|suspension|exhaust|alternator|starter|radiator|bumper|fender|hood|door|mirror)\b/.test(lower)) {
    return 'auto';
  }
  if (/\b(painting|artwork|canvas|sculpture|print|lithograph|watercolor|oil paint|sketch|drawing|etching|fine art|gallery|museum)\b/.test(lower)) {
    return 'art';
  }
  if (/\b(pill|medication|medicine|tablet|capsule|drug|prescription|rx|pharmacy|vitamin|supplement|aspirin|ibuprofen)\b/.test(lower)) {
    return 'medication';
  }
  return null;
}

// ─── Domain action buttons ─────────────────────────────────────────────────────

interface DomainButtonProps {
  domain: 'auto' | 'art' | 'medication';
  itemName: string;
  category: string;
  estimatedValue: number;
}

const DomainActionButton: React.FC<DomainButtonProps> = ({ domain, itemName, category, estimatedValue }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const configs = {
    auto: {
      label: 'Identify This Part',
      icon: Wrench,
      color: 'bg-orange-600 hover:bg-orange-500',
      endpoint: '/api/auto-parts',
      body: { itemName, userId: undefined },
    },
    art: {
      label: 'Authenticate Artwork',
      icon: Palette,
      color: 'bg-violet-600 hover:bg-violet-500',
      endpoint: '/api/fine-art',
      body: { artistName: itemName, title: itemName },
    },
    medication: {
      label: 'Identify Medication',
      icon: Pill,
      color: 'bg-blue-600 hover:bg-blue-500',
      endpoint: '/api/medication-id',
      body: { imprint: itemName },
    },
  };

  const cfg = configs[domain];
  const Icon = cfg.icon;

  const handleTap = async () => {
    setLoading(true);
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg.body),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        toast.success(`${cfg.label} complete`);
      } else {
        toast.error('Analysis failed — try again');
      }
    } catch {
      toast.error('Network error — try again');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    // Show a summary toast-style result inline
    const summary =
      result.autopart?.partName ||
      result.artwork?.artist_likely ||
      result.medication?.likelyName ||
      'Result ready';

    return (
      <div className="col-span-2 p-3 rounded-lg border border-white/10 bg-white/5 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-white/60" />
          <p className="font-medium text-white text-xs">{summary}</p>
        </div>
        {result.medication?.disclaimer && (
          <p className="text-[10px] text-red-400/80 leading-tight">
            {result.medication.disclaimer.text}
          </p>
        )}
        {result.artwork?.disclaimer && (
          <p className="text-[10px] text-white/40 leading-tight mt-1">
            {result.artwork.disclaimer}
          </p>
        )}
        {result.autopart?.disclaimer && (
          <p className="text-[10px] text-white/40 leading-tight mt-1">
            {result.autopart.disclaimer}
          </p>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="default"
      className={`w-full text-white text-xs ${cfg.color}`}
      onClick={handleTap}
      disabled={loading}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          Analyzing...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
      )}
    </Button>
  );
};

// ─── Ownership hub button ──────────────────────────────────────────────────────

const OwnershipButton: React.FC<{ itemName: string; category: string; brandName?: string }> = ({
  itemName, category, brandName
}) => {
  const [loading, setLoading] = useState(false);
  const [ownership, setOwnership] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTap = async () => {
    if (ownership) { setExpanded(p => !p); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ itemName, category });
      if (brandName) params.set('brandName', brandName);
      const res = await fetch(`/api/product-ownership?${params}`);
      const data = await res.json();
      if (data.success) { setOwnership(data.ownership); setExpanded(true); }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col-span-2">
      <Button
        variant="outline"
        className="w-full text-xs border-white/10 text-white/70 hover:bg-white/10"
        onClick={handleTap}
        disabled={loading}
      >
        <Package className="w-3.5 h-3.5 mr-1.5" />
        {loading ? 'Loading...' : ownership ? (expanded ? 'Hide Care Guide ↑' : 'Show Care Guide ↓') : 'Care & Maintenance'}
      </Button>

      {ownership && expanded && (
        <div className="mt-2 p-3 rounded-lg border border-white/10 bg-white/5 space-y-2">
          {ownership.maintenance?.slice(0, 2).map((m: any) => (
            <div key={m.task} className="flex justify-between items-center">
              <span className="text-xs text-white/60">{m.task}</span>
              <span className="text-[10px] text-white/30">Due {m.nextDue}</span>
            </div>
          ))}
          {ownership.tutorials?.slice(0, 1).map((t: any) => (
            <a
              key={t.title}
              href={t.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-3 h-3" />
              {t.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN ACTION HUB
// =============================================================================

const ActionHub: React.FC<ActionHubProps> = ({
  analysisResult,
  marketplaceItem,
  ghostData,
  isViewingHistory,
  onClear,
  onDeleteFromHistory,
  onListOnTagnetiq,
}) => {
  const navigate = useNavigate();
  const [showWhatnotCard, setShowWhatnotCard] = useState(false);

  // Extract from analysisResult for domain detection
  const itemName = analysisResult?.itemName || analysisResult?.item_name || '';
  const category = analysisResult?.category || '';
  const estimatedValue = analysisResult?.estimatedValue || analysisResult?.estimated_value || 0;
  const brandName = analysisResult?.luxuryAuthentication?.brandName || undefined;
  const votes = analysisResult?.hydraConsensus?.votes || [];

  const domainCategory = detectDomainCategory(category, itemName);

  return (
    <div className="w-full p-4 border border-border/50 rounded-xl bg-background/50">
      <h3 className="text-xs font-semibold mb-3 text-center text-muted-foreground uppercase tracking-wider">
        Action Hub
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {!isViewingHistory ? (
          <>
            {/* Core actions */}
            <AddToVaultButton analysisResult={analysisResult} onSuccess={onClear} />
            <ListOnMarketplaceButton
              item={marketplaceItem}
              ghostData={ghostData}
              onListOnTagnetiq={onListOnTagnetiq}
            />

            {/* Whatnot listing */}
            <Button
              variant="secondary"
              className="w-full text-xs bg-orange-950/40 text-orange-300 border border-orange-500/20 hover:bg-orange-950/60"
              onClick={() => setShowWhatnotCard(p => !p)}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {showWhatnotCard ? 'Hide Whatnot ↑' : 'List on Whatnot'}
            </Button>

            {/* Social share placeholder */}
            <Button
              variant="secondary"
              className="w-full text-xs"
              onClick={() => toast.info('Social sharing coming soon!')}
            >
              Share to Social
            </Button>

            {/* Domain-specific button */}
            {domainCategory && (
              <DomainActionButton
                domain={domainCategory}
                itemName={itemName}
                category={category}
                estimatedValue={estimatedValue}
              />
            )}

            {/* Care & Maintenance — always shown */}
            <OwnershipButton
              itemName={itemName}
              category={category}
              brandName={brandName}
            />

            {/* Wellness quick link */}
            <Button
              variant="ghost"
              className="w-full text-xs text-white/30 hover:text-white/60"
              onClick={() => navigate('/wellness')}
            >
              <Heart className="w-3.5 h-3.5 mr-1.5" />
              Meditation
            </Button>

            {/* Clear */}
            <Button variant="outline" onClick={onClear} className="w-full text-xs">
              Clear & Scan Next
            </Button>
          </>
        ) : (
          <>
            <AddToVaultButton analysisResult={analysisResult} />
            <Button
              variant="destructive"
              className="w-full"
              onClick={onDeleteFromHistory}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </>
        )}
      </div>

      {/* Whatnot listing card — expands inline below the grid */}
      {showWhatnotCard && !isViewingHistory && (
        <div className="mt-3">
          <WhatnotListingCard
            itemName={itemName}
            estimatedValue={estimatedValue}
            category={category}
            condition={analysisResult?.condition || 'good'}
            votes={votes}
          />
        </div>
      )}
    </div>
  );
};

export default ActionHub;
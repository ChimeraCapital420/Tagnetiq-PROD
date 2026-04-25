// FILE: src/components/analysis/StyleScanLanes.tsx
// RH-028 Phase 1 — StyleScan Three-Lane Display
// Shows official retail, resale market, and budget substitute lanes
// for any detected fashion/luxury brand.
//
// Usage:
//   import StyleScanLanes from '@/components/analysis/StyleScanLanes';
//   <StyleScanLanes itemName="Speedy 30" brandName="Louis Vuitton" category="luxury_handbags" />

import React, { useState, useEffect } from 'react';
import { ShoppingBag, RefreshCw, DollarSign, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { buildStyleScanLanes, trackAffiliateClick } from '@/lib/affiliate/affiliate-engine';
import type { StyleScanLanes as StyleScanLanesType, AffiliatePartner } from '@/lib/affiliate/affiliate-engine';

interface StyleScanLanesProps {
  itemName: string;
  brandName: string;
  category?: 'fashion' | 'sneakers' | 'handbags' | 'jewelry' | 'watches' | 'general';
  scanId?: string;
  userId?: string;
  className?: string;
}

const LANE_CONFIG = {
  official: {
    label: 'Buy Official',
    sublabel: 'Brand direct & authorized retailers',
    icon: ShoppingBag,
    color: 'text-blue-400',
    bg: 'bg-blue-950/30 border-blue-500/20',
    buttonBg: 'bg-blue-600 hover:bg-blue-500',
  },
  resale: {
    label: 'Buy Resale',
    sublabel: 'Pre-owned — typically 30–70% less',
    icon: RefreshCw,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/30 border-emerald-500/20',
    buttonBg: 'bg-emerald-700 hover:bg-emerald-600',
  },
  substitute: {
    label: 'Budget Alternative',
    sublabel: 'Similar style at lower price',
    icon: DollarSign,
    color: 'text-purple-400',
    bg: 'bg-purple-950/30 border-purple-500/20',
    buttonBg: 'bg-purple-700 hover:bg-purple-600',
  },
} as const;

type LaneKey = keyof typeof LANE_CONFIG;

const StyleScanLanes: React.FC<StyleScanLanesProps> = ({
  itemName,
  brandName,
  category = 'fashion',
  scanId,
  userId,
  className = '',
}) => {
  const [lanes, setLanes] = useState<StyleScanLanesType | null>(null);
  const [openLane, setOpenLane] = useState<LaneKey | null>('resale');

  useEffect(() => {
    if (!itemName || !brandName) return;
    const built = buildStyleScanLanes(itemName, brandName, category);
    setLanes(built);
  }, [itemName, brandName, category]);

  if (!lanes) return null;

  const handleLinkClick = (
    platform: string,
    url: string,
    laneKey: LaneKey
  ) => {
    // Track click for affiliate analytics
    trackAffiliateClick(
      platform.toLowerCase().replace(/\s+/g, '_') as AffiliatePartner,
      `${brandName} ${itemName}`,
      scanId,
      userId
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderLane = (laneKey: LaneKey) => {
    const config = LANE_CONFIG[laneKey];
    const links = lanes[laneKey];
    if (!links || links.length === 0) return null;

    const Icon = config.icon;
    const isOpen = openLane === laneKey;

    return (
      <div key={laneKey} className={`rounded-xl border overflow-hidden ${config.bg}`}>
        {/* Lane header */}
        <button
          onClick={() => setOpenLane(isOpen ? null : laneKey)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <Icon className={`w-4 h-4 shrink-0 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{config.label}</p>
            <p className="text-xs text-white/50">{config.sublabel}</p>
          </div>
          {isOpen
            ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
            : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
          }
        </button>

        {/* Lane links */}
        {isOpen && (
          <div className="border-t border-white/10 px-4 pb-3 pt-2 space-y-2">
            {links.map((link, i) => (
              <button
                key={i}
                onClick={() => handleLinkClick(link.platform, link.url, laneKey)}
                className={`
                  w-full flex items-center justify-between
                  px-3 py-2.5 rounded-lg text-sm
                  ${config.buttonBg} text-white
                  transition-all active:scale-[0.98]
                `}
              >
                <span className="font-medium">{link.label}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs text-white/40 px-1 font-medium uppercase tracking-wider">
        Shop This Item
      </p>
      {(['official', 'resale', 'substitute'] as LaneKey[]).map(renderLane)}
    </div>
  );
};

export default StyleScanLanes;
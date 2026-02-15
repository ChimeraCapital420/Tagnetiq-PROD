// FILE: src/components/analysis/components/NexusDecisionCard.tsx
// v10.2 — CRASH-PROOF
// FIX: Guards nexus.actions?.map() — no crash on undefined
// FIX: Guards nexus.listingDraft nested access
// FIX: Returns null gracefully if data is malformed
// FIX: Defensive against both SSE and standard response shapes

import React from 'react';
import {
  ShoppingCart,
  TrendingUp,
  ExternalLink,
  Share2,
  Store,
  Tag,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// TYPES
// =============================================================================

interface NexusAction {
  type: string;
  label: string;
  description?: string;
  url?: string;
  icon?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface ListingDraft {
  title?: string;
  description?: string;
  suggestedPrice?: number;
  platform?: string;
  tags?: string[];
}

interface NexusDecisionCardProps {
  nexus: any; // Intentionally any — defensive against shape changes
  itemName?: string;
  estimatedValue?: number;
  decision?: string;
  category?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getActionIcon(type: string) {
  switch (type) {
    case 'list_arena':
    case 'listInArena':
      return <Store className="w-4 h-4" />;
    case 'sell_pro':
    case 'sellOnProPlatforms':
      return <ShoppingCart className="w-4 h-4" />;
    case 'share':
    case 'shareToSocial':
      return <Share2 className="w-4 h-4" />;
    case 'link_store':
    case 'linkToMyStore':
      return <ExternalLink className="w-4 h-4" />;
    case 'price_alert':
      return <TrendingUp className="w-4 h-4" />;
    default:
      return <Tag className="w-4 h-4" />;
  }
}

function getDecisionColor(decision: string): string {
  switch (decision?.toUpperCase()) {
    case 'BUY':
      return 'from-emerald-600 to-green-700';
    case 'SELL':
      return 'from-blue-600 to-indigo-700';
    case 'HOLD':
      return 'from-yellow-600 to-amber-700';
    case 'PASS':
      return 'from-red-600 to-rose-700';
    default:
      return 'from-gray-600 to-gray-700';
  }
}

function getDecisionEmoji(decision: string): string {
  switch (decision?.toUpperCase()) {
    case 'BUY':
      return '🟢';
    case 'SELL':
      return '🔵';
    case 'HOLD':
      return '🟡';
    case 'PASS':
      return '🔴';
    default:
      return '⚪';
  }
}

// Extract actions from various shapes
function extractActions(nexus: any): NexusAction[] {
  if (!nexus) return [];

  // Shape 1: nexus.actions array
  if (Array.isArray(nexus.actions)) {
    return nexus.actions
      .filter((a: any) => a && typeof a === 'object')
      .map((a: any) => ({
        type: a.type || a.key || 'unknown',
        label: a.label || a.type || 'Action',
        description: a.description || '',
        url: a.url || null,
        priority: a.priority || 'medium',
      }));
  }

  // Shape 2: resale_toolkit flat object (from analyze-stream)
  if (nexus.listInArena !== undefined || nexus.sellOnProPlatforms !== undefined) {
    const actions: NexusAction[] = [];
    if (nexus.listInArena) {
      actions.push({
        type: 'list_arena',
        label: 'List in Arena',
        description: 'Sell in the Tagnetiq marketplace',
        priority: 'high',
      });
    }
    if (nexus.sellOnProPlatforms) {
      actions.push({
        type: 'sell_pro',
        label: 'Sell on Pro Platforms',
        description: 'eBay, Mercari, Poshmark',
        priority: 'medium',
      });
    }
    if (nexus.shareToSocial) {
      actions.push({
        type: 'share',
        label: 'Share to Social',
        description: 'Show off your find',
        priority: 'low',
      });
    }
    if (nexus.linkToMyStore) {
      actions.push({
        type: 'link_store',
        label: 'Link to My Store',
        description: 'Add to your storefront',
        priority: 'medium',
      });
    }
    return actions;
  }

  return [];
}

// =============================================================================
// COMPONENT
// =============================================================================

const NexusDecisionCard: React.FC<NexusDecisionCardProps> = ({
  nexus,
  itemName,
  estimatedValue,
  decision,
  category,
}) => {
  // Guard: no data at all
  if (!nexus && !decision && !estimatedValue) {
    return null;
  }

  const actions = extractActions(nexus);
  const resolvedDecision = decision || nexus?.decision || 'SELL';
  const resolvedValue = estimatedValue ?? nexus?.estimatedValue ?? 0;
  const listingDraft: ListingDraft | null = nexus?.listingDraft || null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Decision header */}
      <div
        className={`bg-gradient-to-r ${getDecisionColor(resolvedDecision)} px-4 py-3`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {getDecisionEmoji(resolvedDecision)}
            </span>
            <div>
              <p className="text-white font-bold text-lg">
                {resolvedDecision.toUpperCase()}
              </p>
              {itemName && (
                <p className="text-white/70 text-xs truncate max-w-48">
                  {itemName}
                </p>
              )}
            </div>
          </div>
          {resolvedValue > 0 && (
            <div className="text-right">
              <p className="text-white font-bold text-xl">
                ${resolvedValue.toFixed(2)}
              </p>
              {category && (
                <p className="text-white/60 text-xs">
                  {category.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Listing draft (if available) */}
      {listingDraft?.title && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs text-white/40 mb-1">Suggested Listing</p>
          <p className="text-sm text-white/80 font-medium">
            {listingDraft.title}
          </p>
          {listingDraft.description && (
            <p className="text-xs text-white/50 mt-1 line-clamp-2">
              {listingDraft.description}
            </p>
          )}
          {listingDraft.tags && listingDraft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {listingDraft.tags.slice(0, 5).map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-white/40 mb-2">Resale Toolkit</p>
          {actions.map((action, index) => (
            <Button
              key={`${action.type}-${index}`}
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-left touch-manipulation ${
                action.priority === 'high'
                  ? 'text-white/90 bg-white/10 hover:bg-white/15'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
              }`}
              onClick={() => {
                if (action.url) {
                  window.open(action.url, '_blank');
                }
              }}
            >
              {getActionIcon(action.type)}
              <span className="ml-2 flex-1">
                <span className="text-sm">{action.label}</span>
                {action.description && (
                  <span className="block text-xs text-white/40">
                    {action.description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {actions.length === 0 && !listingDraft && (
        <div className="px-4 py-3 text-center text-xs text-white/30">
          <Clock className="w-4 h-4 mx-auto mb-1 opacity-50" />
          Resale options loading...
        </div>
      )}
    </div>
  );
};

export default NexusDecisionCard;
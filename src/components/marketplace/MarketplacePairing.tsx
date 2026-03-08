// FILE: src/components/marketplace/MarketplacePairing.tsx
// ═══════════════════════════════════════════════════════════════════════
// Marketplace Pairing — Conversational Connection Flow
// ═══════════════════════════════════════════════════════════════════════
//
// This is NOT a settings page with OAuth buttons.
// Oracle asks where you sell, guides you through the connection,
// and drafts your first listing. Pairing happens conversationally.
//
// FLOW:
//   Step 1: Oracle asks "Where do you usually sell things?"
//           Shows marketplace icons as tappable choices.
//   Step 2: User selects marketplace. Oracle checks if already paired.
//   Step 3 (not paired): Oracle asks "Do you have an account there?"
//   Step 4a (yes): Oracle highlights connect button, guides through OAuth.
//   Step 4b (no): Oracle provides signup link, saves item to vault,
//                 sets reminder to continue when account is ready.
//   Step 5 (paired): Oracle drafts listing, shows preview, user approves.
//
// SUPPORTED MARKETPLACES (Phase 1):
//   eBay — OAuth (primary)
//   Facebook Marketplace — link out (no API)
//   Mercari — link out
//   Poshmark — link out
//   OfferUp — link out
//   Craigslist — link out (local only)
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Circle, Zap, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { AnalysisResult } from '@/contexts/AppContext';

// =============================================================================
// MARKETPLACE CONFIG
// =============================================================================

interface Marketplace {
  id: string;
  name: string;
  emoji: string;
  hasOAuth: boolean;
  signupUrl: string;
  oauthPath?: string;
  /** Best for these categories */
  bestFor: string[];
  trustLevelMin: number;
}

const MARKETPLACES: Marketplace[] = [
  {
    id: 'ebay',
    name: 'eBay',
    emoji: '🟦',
    hasOAuth: true,
    signupUrl: 'https://www.ebay.com/register',
    oauthPath: '/api/marketplace/ebay/connect',
    bestFor: ['electronics', 'collectibles', 'antiques', 'clothing'],
    trustLevelMin: 1,
  },
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    emoji: '🟦',
    hasOAuth: false,
    signupUrl: 'https://www.facebook.com/marketplace',
    bestFor: ['furniture', 'local', 'general'],
    trustLevelMin: 1,
  },
  {
    id: 'mercari',
    name: 'Mercari',
    emoji: '🔴',
    hasOAuth: false,
    signupUrl: 'https://www.mercari.com',
    bestFor: ['clothing', 'toys', 'electronics', 'home'],
    trustLevelMin: 1,
  },
  {
    id: 'poshmark',
    name: 'Poshmark',
    emoji: '🩷',
    hasOAuth: false,
    signupUrl: 'https://poshmark.com',
    bestFor: ['clothing', 'accessories', 'shoes', 'luxury'],
    trustLevelMin: 2,
  },
  {
    id: 'offerup',
    name: 'OfferUp',
    emoji: '🟢',
    hasOAuth: false,
    signupUrl: 'https://offerup.com',
    bestFor: ['local', 'furniture', 'tools', 'general'],
    trustLevelMin: 1,
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    emoji: '⚫',
    hasOAuth: false,
    signupUrl: 'https://www.craigslist.org',
    bestFor: ['local', 'large items', 'vehicles', 'furniture'],
    trustLevelMin: 3,
  },
];

// =============================================================================
// FLOW STEPS
// =============================================================================

type FlowStep =
  | 'select_marketplace'
  | 'has_account'
  | 'connecting'
  | 'no_account'
  | 'draft_listing'
  | 'complete';

// =============================================================================
// COMPONENT
// =============================================================================

interface MarketplacePairingProps {
  /** Analysis result to list (optional — can pair without active result) */
  result?: AnalysisResult | null;
  onComplete?: () => void;
  onDismiss?: () => void;
}

const MarketplacePairing: React.FC<MarketplacePairingProps> = ({
  result,
  onComplete,
  onDismiss,
}) => {
  const { trustLevel, isEstateTrust } = useAppContext();
  const { profile } = useAuth();

  const [step, setStep] = useState<FlowStep>('select_marketplace');
  const [selected, setSelected] = useState<Marketplace | null>(null);
  const [draftListing, setDraftListing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const level = trustLevel ?? 1;
  const isEstate = isEstateTrust ?? false;

  // Filter marketplaces to trust level appropriate ones
  const availableMarkets = MARKETPLACES.filter(m => m.trustLevelMin <= level);

  // Check if marketplace is already paired
  const marketplaceAccounts = (profile as any)?.marketplace_accounts ?? {};
  const isPaired = (marketId: string) => !!marketplaceAccounts[marketId];

  // ── Oracle message per step ────────────────────────────────────────
  const getOracleMessage = (): string => {
    switch (step) {
      case 'select_marketplace':
        return isEstate
          ? "When you're ready to sell, where would you like to list? I can help guide you through it."
          : result
            ? `Good find — let's get this listed. Where do you usually sell?`
            : "Let's connect your selling account. Where do you usually sell?";
      case 'has_account':
        return `Do you already have a ${selected?.name} account?`;
      case 'connecting':
        return `Let's connect your ${selected?.name} account. I'll walk you through it — it only takes a minute.`;
      case 'no_account':
        return `No problem. I'll save this item to your vault and remind you once your account is set up.`;
      case 'draft_listing':
        return `Here's a draft listing for your ${result?.itemName}. Look it over and I'll submit it when you're ready.`;
      case 'complete':
        return isEstate
          ? "Saved. I've documented this item and it's ready whenever you want to list it."
          : "You're all set. I'll track the listing and let you know when it sells.";
      default:
        return '';
    }
  };

  // ── Generate listing draft ─────────────────────────────────────────
  const generateDraft = async (market: Marketplace) => {
    if (!result) return;
    setIsGenerating(true);
    // Draft is generated from analysis result data
    const salesCopy = result.resale_toolkit?.sales_copy;
    const draft = salesCopy
      ? salesCopy
      : `${result.itemName} — ${result.estimatedValue} estimated value. ${result.summary_reasoning?.slice(0, 120) ?? ''}`;
    setDraftListing(draft);
    setIsGenerating(false);
    setStep('draft_listing');
  };

  // ── Step: Select marketplace ───────────────────────────────────────
  const handleSelectMarket = (market: Marketplace) => {
    setSelected(market);
    if (isPaired(market.id)) {
      // Already connected — go straight to listing
      if (result) generateDraft(market);
      else setStep('complete');
    } else {
      setStep('has_account');
    }
  };

  // ── Step: Has account? ─────────────────────────────────────────────
  const handleHasAccount = (has: boolean) => {
    if (has) {
      setStep(selected?.hasOAuth ? 'connecting' : 'draft_listing');
      if (!selected?.hasOAuth && result) generateDraft(selected!);
    } else {
      setStep('no_account');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Oracle message */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm text-foreground leading-relaxed pt-1">
          {getOracleMessage()}
        </p>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Step: Select Marketplace ─────────────────────────────── */}
      {step === 'select_marketplace' && (
        <div className="grid grid-cols-2 gap-2">
          {availableMarkets.map(market => (
            <button
              key={market.id}
              onClick={() => handleSelectMarket(market)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border text-left',
                'transition-colors hover:bg-muted',
                isPaired(market.id)
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-border/50 bg-background',
              )}
            >
              <span className="text-lg">{market.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{market.name}</p>
                {isPaired(market.id) && (
                  <p className="text-[10px] text-green-500">Connected</p>
                )}
              </div>
              {isPaired(market.id) && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Step: Has Account? ───────────────────────────────────── */}
      {step === 'has_account' && selected && (
        <div className="flex gap-3">
          <Button onClick={() => handleHasAccount(true)} className="flex-1">
            Yes, I have one
          </Button>
          <Button onClick={() => handleHasAccount(false)} variant="outline" className="flex-1">
            Not yet
          </Button>
        </div>
      )}

      {/* ── Step: Connect OAuth ──────────────────────────────────── */}
      {step === 'connecting' && selected?.hasOAuth && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Tapping Connect will open {selected.name} — log in and approve access.
            You'll come right back here.
          </p>
          <Button
            onClick={() => window.location.href = selected.oauthPath!}
            className="w-full gap-2"
          >
            Connect {selected.name}
            <ExternalLink className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setStep('select_marketplace')}
            className="text-xs text-muted-foreground text-center underline-offset-2 hover:underline"
          >
            Choose a different marketplace
          </button>
        </div>
      )}

      {/* ── Step: No account ─────────────────────────────────────── */}
      {step === 'no_account' && selected && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {isEstate
              ? "I've saved this item to your vault. Come back when you're ready and I'll help you list it."
              : "No problem — I'll save this to your vault. Once you're set up, I'll draft the listing for you."}
          </p>
          <div className="flex gap-2">
            <a
              href={selected.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" className="w-full gap-2">
                Create {selected.name} account
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <Button onClick={() => { onComplete?.(); }} className="flex-1">
              Save to vault
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Draft listing ──────────────────────────────────── */}
      {step === 'draft_listing' && (
        <div className="flex flex-col gap-3">
          {isGenerating ? (
            <div className="flex items-center gap-2 py-3">
              <Zap className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-sm text-muted-foreground">Drafting your listing…</span>
            </div>
          ) : draftListing ? (
            <>
              <div className="rounded-xl bg-muted/60 border border-border/30 px-3 py-3">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {draftListing}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => { setStep('complete'); onComplete?.(); }}
                  className="flex-1 gap-2"
                >
                  Looks good — submit
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep('select_marketplace')}
                  variant="outline"
                  className="shrink-0"
                >
                  Edit
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Step: Complete ───────────────────────────────────────── */}
      {step === 'complete' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <CheckCircle className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground text-center">
            {isEstate ? "Documented and saved." : "Listed successfully."}
          </p>
          {onComplete && (
            <Button onClick={onComplete} variant="outline" size="sm">
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketplacePairing;
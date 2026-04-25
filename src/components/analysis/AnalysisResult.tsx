// FILE: src/components/analysis/AnalysisResult.tsx
// STATUS: HYDRA v10.8 — Photo Hotspots wired
// Thin orchestrator that composes hooks + components.
//
// v10.1: eBay market display + HYDRA estimate marker
// v10.2: Watch button Authorization header fix
// v10.3: RefineDialog visual evidence props
// v10.4: ActionFork for Trust Level 1–2 users
//
// v10.5 CHANGES — Hardening Sprint #1:
//   - Refinement consensus badge. After refinement, when the API returns
//     refinementConsensus { validProviders, totalProviders }, the card
//     header shows "Refined — 3/3 providers agreed" (or 2/3, etc.).
//     Reads from raw?.refinementConsensus — no hook changes required.
//   - Badge only renders when refinementConsensus is present (post-refinement).
//   - Zero changes to any existing render paths, hooks, or ActionFork logic.
//
// v10.6: Trust gates Oracle autonomy, NOT user buttons.
//   ActionFork disabled — all users see full ActionHub with export/list/vault.
//   Trust level controls what Oracle does automatically, not what the user
//   can manually choose to do.
//
// v10.7: RH-032 + RH-028 + RH-020 wired:
// v10.8: RH-022 Photo Hotspots wired:
//   - PhotoHotspotViewer added below ImageCarousel.
//     User taps any region of the scan photo to analyze it.
//     Intent modes: identify, authenticate (luxury), damage, value.
//     Passes imageBase64 from scan result if available, else fetches from URL.
//     Shows only when at least one image URL is present.
//   - LuxuryAuthBadge: auto-surfaces in CardContent when luxury brand detected.
//     Reads from raw?.luxuryAuthentication — zero impact on non-luxury scans.
//   - StyleScanLanes: 3-lane purchase display (official/resale/substitute) for
//     luxury and fashion brands. Shown below eBay data when luxury detected.
//   - incrementScanCount(): called once per result mount for OracleGreeting
//     suppression logic. New users see intro only; returning users see daily
//     greeting from scan #2 onward.

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ghost, AlertTriangle, Sparkles } from 'lucide-react';
import { HydraConsensusDisplay } from '@/components/HydraConsensusDisplay.js';
import { AnalysisHistoryNavigator } from '@/components/AnalysisHistoryNavigator.js';
import { AuthorityReportCard } from '@/components/AuthorityReportCard.js';
import { ListOnMarketplaceButton } from '@/components/marketplace/ListOnMarketplaceButton.js';

// — Local modules —
import { useAnalysisData, useListingSubmit, useFeedback } from './hooks/index.js';
import {
  NexusDecisionCard,
  GhostDataDisplay,
  ImageCarousel,
  ValuationDetails,
  ActionHub,
  FeedbackStars,
  RefineDialog,
  EbayMarketDisplay,
} from './components/index.js';
import ActionFork from './ActionFork.js';

// v10.7: RH-032 luxury auth badge + RH-028 StyleScan lanes
import LuxuryAuthBadge from './LuxuryAuthBadge.js';
import StyleScanLanes from './StyleScanLanes.js';
// v10.7: OracleGreeting scan counter — call once per successful scan result mount
import { incrementScanCount } from '@/components/oracle/OracleGreeting.js';
// v10.8: RH-022 Photo Hotspots — tap any image region for targeted AI analysis
import PhotoHotspotViewer from './PhotoHotspotViewer.js';

// =============================================================================
// ERROR BOUNDARY
// =============================================================================

interface ErrorBoundaryState { hasError: boolean; error?: Error }

class AnalysisErrorBoundary extends Component<
  { children: ReactNode; onClear: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onClear: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AnalysisResult Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-full max-w-4xl mx-auto border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Display Error</h3>
            <p className="text-sm text-muted-foreground mb-4">
              There was a problem displaying this analysis result.
            </p>
            <p className="text-xs text-red-500 font-mono mb-4">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <Button onClick={this.props.onClear} variant="outline">
              Clear & Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map luxury brand category to StyleScanLanes category prop.
 * Affiliate engine uses its own category strings — normalize here.
 */
function toLaneCategory(
  brandCategory: string
): 'fashion' | 'sneakers' | 'handbags' | 'jewelry' | 'watches' | 'general' {
  if (brandCategory.includes('handbag')) return 'handbags';
  if (brandCategory === 'sneakers')      return 'sneakers';
  if (brandCategory === 'watches')       return 'watches';
  if (brandCategory === 'jewelry')       return 'jewelry';
  if (brandCategory.includes('fashion')) return 'fashion';
  return 'general';
}

// =============================================================================
// MAIN CONTENT
// =============================================================================

const AnalysisResultContent: React.FC = () => {
  const { setLastAnalysisResult, deleteFromHistory, trustLevel } = useAppContext();
  const { user, session } = useAuth();
  const { raw, data, history, ebayData, marketSources } = useAnalysisData();
  const handleListOnTagnetiq = useListingSubmit(data);
  const [nexusDismissed, setNexusDismissed] = useState(false);

  const feedback = useFeedback(data?.id || '', history.isViewingHistory);

  // v10.7: Increment scan count for OracleGreeting suppression.
  // Only fires once per new result (not when viewing history).
  // This is what tells OracleGreeting "user has scanned before" →
  // daily greeting appears from scan #2 onward, not on first visit.
  useEffect(() => {
    if (data && !history.isViewingHistory) {
      incrementScanCount();
    }
  }, [data?.id]); // Only fires when analysis ID changes (new scan)

  if (!data) return null;

  // — Action handlers —
  const handleClear = () => setLastAnalysisResult(null);

  const handleDeleteFromHistory = async () => {
    if (history.historyItem && deleteFromHistory) {
      if (confirm('Remove this analysis from your history?')) {
        await deleteFromHistory(history.historyItem.id);
      }
    }
  };

  const handleNexusList = () => toast.info('Opening listing flow...');
  const handleNexusVault = () => toast.info('Adding to vault...');
  const handleNexusScanMore = () => setLastAnalysisResult(null);

  const handleNexusWatch = async () => {
    if (!user) { toast.error('Please log in to watch prices'); return; }
    try {
      const res = await fetch('/api/oracle/argos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({
          action: 'watch',
          itemName: data.itemName,
          category: data.category,
          estimatedValue: data.estimatedValue,
        }),
      });
      toast.success(res.ok ? 'Added to price watchlist!' : 'Could not add to watchlist');
    } catch {
      toast.error('Could not add to watchlist. Try again.');
    }
  };

  const showActionFork = false;

  // v10.5: Refinement consensus badge data
  const refinementConsensus = (raw as any)?.refinementConsensus as {
    validProviders: number;
    totalProviders: number;
    agreementRate: number;
  } | undefined;

  // v10.7: Luxury authentication data from analyze.ts v9.9.1
  // null for non-luxury items — zero render cost
  const luxuryAuth = (raw as any)?.luxuryAuthentication ?? null;
  const isLuxury = !!luxuryAuth?.isLuxury;

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm animate-fade-in relative">
        <AnalysisHistoryNavigator />

        {/* — Header — */}
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2 flex-wrap">
                {data.itemName}
                {data.ghostData && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Ghost className="h-3 w-3 mr-1" />Ghost
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                {data.category}
                {history.isViewingHistory && history.historyItem?.created_at && (
                  <Badge variant="secondary" className="text-xs">
                    {new Date(history.historyItem.created_at).toLocaleDateString()}
                  </Badge>
                )}
              </CardDescription>
            </div>

            {/* Confidence + refinement consensus badges */}
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={`${data.confidenceColor} text-white`}>
                Confidence: {data.confidenceScore.toFixed(0)}%
              </Badge>

              {/* v10.5: Refinement consensus — only shown post-refinement */}
              {refinementConsensus && (
                <Badge
                  variant="outline"
                  className="text-xs border-primary/40 text-primary flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Refined — {refinementConsensus.validProviders}/{refinementConsensus.totalProviders} agreed
                </Badge>
              )}
            </div>
          </div>

          {/* HYDRA Consensus */}
          {data.hydraConsensus && typeof data.hydraConsensus === 'object' && (
            <div className="mt-4"><HydraConsensusDisplay consensus={data.hydraConsensus} /></div>
          )}

          {/* Authority Report Card */}
          {data.authorityData && typeof data.authorityData === 'object' && data.authorityData.source && (
            <div className="mt-4"><AuthorityReportCard authorityData={data.authorityData} /></div>
          )}

          {/* Ghost Protocol Data */}
          {data.ghostData && typeof data.ghostData === 'object' && (
            <GhostDataDisplay ghostData={data.ghostData} />
          )}
        </CardHeader>

        {/* — Content: Images + Valuation + Luxury Auth + StyleScan — */}
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageCarousel imageUrls={data.allImageUrls} itemName={data.itemName} />
            <ValuationDetails
              estimatedValue={data.estimatedValue}
              valuationFactors={data.valuationFactors}
              summaryReasoning={data.summaryReasoning}
              isViewingHistory={history.isViewingHistory}
              onRefine={() => feedback.setIsRefineOpen(true)}
            />
          </div>

          {/* ─────────────────────────────────────────────────────────
              v10.8: RH-022 — Photo Hotspot Viewer
              Tap any area of the scan photo to analyze it with AI vision.
              Intent auto-set to 'authenticate' for luxury items.
              Null-safe: only renders when image URLs are available.
              ───────────────────────────────────────────────────────── */}
          {data.allImageUrls?.length > 0 && (
            <PhotoHotspotViewer
              imageUrl={data.allImageUrls[0]}
              itemName={data.itemName}
              category={data.category}
              analysisId={data.id}
              userId={user?.id}
              isLuxury={isLuxury}
            />
          )}

          {/* eBay Market Data */}
          {ebayData && typeof ebayData === 'object' && (
            <EbayMarketDisplay
              ebayData={ebayData}
              estimatedValue={data.estimatedValue}
              itemName={data.itemName}
            />
          )}

          {/* ─────────────────────────────────────────────────────────
              v10.7: RH-032 — Luxury Authentication Badge
              Auto-surfaces when HYDRA identifies a luxury brand.
              Null for non-luxury items — zero layout shift.
              ───────────────────────────────────────────────────────── */}
          {isLuxury && (
            <LuxuryAuthBadge
              auth={luxuryAuth}
              onAuthenticateTap={() => {
                // Wire to full authentication flow when RH-041 Phase 2 ships.
                // For now: scroll to NFC guidance in the expanded badge.
                toast.info(
                  luxuryAuth.nfcCapable
                    ? `Hold your phone to the ${luxuryAuth.brandName} interior lining to scan the NFC chip.`
                    : `Check stitching, hardware stamps, and date code format to authenticate this ${luxuryAuth.brandName}.`,
                  { duration: 6000 }
                );
              }}
            />
          )}

          {/* ─────────────────────────────────────────────────────────
              v10.7: RH-028 — StyleScan Three-Lane Purchase Display
              Shows official retail, resale market, and budget substitute
              lanes for luxury and fashion brands.
              Only renders when luxury brand is detected.
              ───────────────────────────────────────────────────────── */}
          {isLuxury && luxuryAuth.brandName && (
            <StyleScanLanes
              itemName={data.itemName}
              brandName={luxuryAuth.brandName}
              category={toLaneCategory(luxuryAuth.category)}
              scanId={data.id}
              userId={user?.id}
            />
          )}
        </CardContent>

        {/* — Footer: Actions + Feedback — */}
        <CardFooter className="flex flex-col gap-4">
          {!history.isViewingHistory && data.nexusData && !nexusDismissed ? (
            <NexusDecisionCard
              nexus={data.nexusData}
              analysisId={data.id}
              onList={handleNexusList}
              onVault={handleNexusVault}
              onWatch={handleNexusWatch}
              onDismiss={() => setNexusDismissed(true)}
              onScanMore={handleNexusScanMore}
            />
          ) : showActionFork ? (
            <ActionFork
              result={raw}
              onList={handleNexusList}
              onVault={handleNexusVault}
              onWatch={handleNexusWatch}
              onAskOracle={() => {}}
              onScanMore={handleNexusScanMore}
              onDeleteFromHistory={handleDeleteFromHistory}
              isViewingHistory={history.isViewingHistory}
            />
          ) : (
            <ActionHub
              analysisResult={raw}
              marketplaceItem={data.marketplaceItem}
              ghostData={data.ghostData}
              isViewingHistory={history.isViewingHistory}
              onClear={handleClear}
              onDeleteFromHistory={handleDeleteFromHistory}
              onListOnTagnetiq={handleListOnTagnetiq}
            />
          )}

          {!history.isViewingHistory && (
            <FeedbackStars
              hoveredRating={feedback.hoveredRating}
              givenRating={feedback.givenRating}
              feedbackSubmitted={feedback.feedbackSubmitted}
              onHover={feedback.setHoveredRating}
              onLeave={() => feedback.setHoveredRating(0)}
              onRate={feedback.submitRating}
            />
          )}
        </CardFooter>
      </Card>

      {/* Refine Dialog */}
      <RefineDialog
        isOpen={feedback.isRefineOpen}
        onOpenChange={feedback.setIsRefineOpen}
        refinementText={feedback.refinementText}
        onTextChange={feedback.setRefinementText}
        refinementImages={feedback.refinementImages}
        onImagesChange={feedback.setRefinementImages}
        isSubmitting={feedback.isRefineSubmitting}
        onSubmit={feedback.submitRefinement}
      />
    </>
  );
};

// =============================================================================
// EXPORTED COMPONENT WITH ERROR BOUNDARY
// =============================================================================

const AnalysisResult: React.FC = () => {
  const { setLastAnalysisResult } = useAppContext();
  return (
    <AnalysisErrorBoundary onClear={() => setLastAnalysisResult(null)}>
      <AnalysisResultContent />
    </AnalysisErrorBoundary>
  );
};

export default AnalysisResult;
// FILE: src/components/analysis/AnalysisResult.tsx
// STATUS: HYDRA v10.1 — Modular + eBay Display + Agreement Fix
// Thin orchestrator that composes hooks + components.
//
// v10.1 CHANGES:
//   - Renders EbayMarketDisplay showing median/low/high/sample from eBay
//   - Agreement factor post-processing in useAnalysisData
//   - eBay price range bar with HYDRA estimate marker

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ghost, AlertTriangle } from 'lucide-react';
import { HydraConsensusDisplay } from '@/components/HydraConsensusDisplay.js';
import { AnalysisHistoryNavigator } from '@/components/AnalysisHistoryNavigator.js';
import { AuthorityReportCard } from '@/components/AuthorityReportCard.js';
import { ListOnMarketplaceButton } from '@/components/marketplace/ListOnMarketplaceButton.js';

// ── Local modules ──
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
// MAIN CONTENT
// =============================================================================

const AnalysisResultContent: React.FC = () => {
  const { setLastAnalysisResult, deleteFromHistory } = useAppContext();
  const { user } = useAuth();
  const { raw, data, history, ebayData, marketSources } = useAnalysisData();
  const handleListOnTagnetiq = useListingSubmit(data);
  const [nexusDismissed, setNexusDismissed] = useState(false);

  const feedback = useFeedback(data?.id || '', history.isViewingHistory);

  if (!data) return null;

  // ── Action handlers ──
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm animate-fade-in relative">
        <AnalysisHistoryNavigator />

        {/* ── Header ── */}
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
            <Badge className={`${data.confidenceColor} text-white`}>
              Confidence: {data.confidenceScore.toFixed(0)}%
            </Badge>
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

        {/* ── Content: Images + Valuation ── */}
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

          {/* ── eBay Market Data (was always fetched, now displayed) ── */}
          {ebayData && typeof ebayData === 'object' && (
            <EbayMarketDisplay
              ebayData={ebayData}
              estimatedValue={data.estimatedValue}
              itemName={data.itemName}
            />
          )}
        </CardContent>

        {/* ── Footer: Actions + Feedback ── */}
        <CardFooter className="flex flex-col gap-4">
          {/* Nexus Decision Tree OR fallback Action Hub */}
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

          {/* Feedback Stars */}
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

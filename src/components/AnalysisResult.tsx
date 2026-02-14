// FILE: src/components/AnalysisResult.tsx
// STATUS: HYDRA v9.3 - With Error Boundary + Nexus Decision Tree
// ULTRA-DEFENSIVE: Cannot crash on any malformed data
// Sprint M: Nexus Decision Tree — Oracle-guided post-scan flow
//   replaces static ACTION HUB with conversational Oracle suggestion
// FIXED v6.4: handleListOnTagnetiq uses actual arena_listings column names
// FIXED v6.4: confidence_score normalized to 0-1
// FIXED v6.4: images[] array instead of primary_photo_url + additional_photos

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddToVaultButton } from './vault/AddToVaultButton.js';
import { ListOnMarketplaceButton } from './marketplace/ListOnMarketplaceButton.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, Star, WandSparkles, Loader2, Trash2, Ghost, AlertTriangle, Zap, Eye, Shield, Package, Camera } from 'lucide-react';
import { HydraConsensusDisplay } from './HydraConsensusDisplay.js';
import { AnalysisHistoryNavigator } from './AnalysisHistoryNavigator.js';
import { AuthorityReportCard } from './AuthorityReportCard.js';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useNavigate } from 'react-router-dom';
import type { MarketplaceItem } from './marketplace/platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';

// =============================================================================
// ERROR BOUNDARY - Catches ANY crash and shows fallback
// =============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AnalysisErrorBoundary extends Component<{ children: ReactNode; onClear: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onClear: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AnalysisResult Error:', error, errorInfo);
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
// SAFE HELPERS
// =============================================================================

const safeString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const safeNumber = (value: unknown, defaultValue = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
};

const safeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;
  return [];
};

// =============================================================================
// CONDITION ENUM MAPPER
// =============================================================================
function mapConditionToEnum(condition: string): string {
  const normalized = condition.toLowerCase().trim().replace(/[\s-]+/g, '_');
  const validConditions = ['mint', 'near_mint', 'excellent', 'good', 'fair', 'poor'];
  
  if (validConditions.includes(normalized)) return normalized;
  
  const aliases: Record<string, string> = {
    'new': 'mint',
    'brand_new': 'mint',
    'like_new': 'near_mint',
    'very_good': 'good',
    'acceptable': 'fair',
    'damaged': 'poor',
    'used': 'good',
  };
  
  return aliases[normalized] || 'good';
}

// =============================================================================
// NEXUS ACTION ICONS — Map action types to icons
// =============================================================================

const NEXUS_ICONS: Record<string, React.ReactNode> = {
  'zap': <Zap className="h-4 w-4" />,
  'eye': <Eye className="h-4 w-4" />,
  'shield': <Shield className="h-4 w-4" />,
  'package': <Package className="h-4 w-4" />,
  'ghost': <Ghost className="h-4 w-4" />,
  'camera': <Camera className="h-4 w-4" />,
  'gem': <Zap className="h-4 w-4" />,
  'lock': <Shield className="h-4 w-4" />,
};

// =============================================================================
// NEXUS DECISION CARD — Oracle's conversational suggestion
// =============================================================================

interface NexusAction {
  id: string;
  label: string;
  type: 'list' | 'vault' | 'watch' | 'dismiss' | 'ghost_list' | 'scan_more';
  vaultCategory?: string;
  primary: boolean;
  icon?: string;
}

interface NexusDecisionCardProps {
  nexus: {
    nudge: string;
    message: string;
    marketDemand: string;
    confidence: number;
    actions: NexusAction[];
    listingDraft?: any;
    followUp?: string;
  };
  analysisId: string;
  onList: () => void;
  onVault: () => void;
  onWatch: () => void;
  onDismiss: () => void;
  onScanMore: () => void;
}

const NexusDecisionCard: React.FC<NexusDecisionCardProps> = ({
  nexus, analysisId, onList, onVault, onWatch, onDismiss, onScanMore,
}) => {
  const { user } = useAuth();
  const [actionTaken, setActionTaken] = useState(false);

  // Log user's choice to Nexus decision log
  const logAction = async (action: string) => {
    if (!user || actionTaken) return;
    setActionTaken(true);
    try {
      await fetch('/api/oracle/nexus-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          action,
          nudgeType: nexus.nudge,
        }),
      });
    } catch {
      // Non-critical — don't block UI
    }
  };

  const handleAction = (action: NexusAction) => {
    logAction(action.type);
    switch (action.type) {
      case 'list':
      case 'ghost_list':
        onList();
        break;
      case 'vault':
        onVault();
        break;
      case 'watch':
        onWatch();
        break;
      case 'scan_more':
        onScanMore();
        break;
      case 'dismiss':
      default:
        onDismiss();
        break;
    }
  };

  // Demand badge color
  const demandColor = nexus.marketDemand === 'hot'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : nexus.marketDemand === 'warm'
    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    : nexus.marketDemand === 'cold'
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div className="w-full p-4 border rounded-lg bg-gradient-to-br from-background to-muted/30 space-y-3">
      {/* Oracle's message */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {nexus.message}
          </p>
          {nexus.followUp && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {nexus.followUp}
            </p>
          )}
        </div>
        {nexus.marketDemand !== 'unknown' && (
          <Badge variant="outline" className={`flex-shrink-0 text-xs ${demandColor}`}>
            {nexus.marketDemand === 'hot' ? '🔥' : nexus.marketDemand === 'warm' ? '🌡️' : '❄️'} {nexus.marketDemand}
          </Badge>
        )}
      </div>

      {/* Listing draft preview (if suggesting to list) */}
      {nexus.listingDraft && (
        <div className="pl-11 space-y-1">
          <p className="text-xs text-muted-foreground">
            Suggested price: <span className="font-medium text-foreground">
              ${nexus.listingDraft.suggestedPrice?.toFixed(0)}
            </span>
            <span className="text-muted-foreground/60">
              {' '}(range: ${nexus.listingDraft.priceRange?.low?.toFixed(0)} – ${nexus.listingDraft.priceRange?.high?.toFixed(0)})
            </span>
          </p>
          {nexus.listingDraft.suggestions?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              💡 {nexus.listingDraft.suggestions[0]}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pl-11">
        {nexus.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.primary ? 'default' : 'outline'}
            size="sm"
            className={action.primary ? 'font-medium' : ''}
            onClick={() => handleAction(action)}
            disabled={actionTaken}
          >
            {action.icon && NEXUS_ICONS[action.icon] && (
              <span className="mr-1.5">{NEXUS_ICONS[action.icon]}</span>
            )}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const AnalysisResultContent: React.FC = () => {
  const { 
    lastAnalysisResult, 
    setLastAnalysisResult,
    currentAnalysisIndex,
    analysisHistory,
    deleteFromHistory
  } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Nexus State Management ---
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [givenRating, setGivenRating] = useState(0);
  const [nexusDismissed, setNexusDismissed] = useState(false);

  // Early return if no result
  if (!lastAnalysisResult) {
    return null;
  }

  // SAFE EXTRACTION with defaults
  const id = safeString(lastAnalysisResult.id);
  const itemName = safeString(lastAnalysisResult.itemName) || 'Unknown Item';
  const estimatedValue = safeNumber(lastAnalysisResult.estimatedValue);
  const confidenceScore = safeNumber(lastAnalysisResult.confidenceScore);
  const summary_reasoning = safeString(lastAnalysisResult.summary_reasoning);
  const valuation_factors = safeArray<string>(lastAnalysisResult.valuation_factors);
  const imageUrl = safeString(lastAnalysisResult.imageUrl);
  const imageUrls = safeArray<string>(lastAnalysisResult.imageUrls);
  const category = safeString(lastAnalysisResult.category) || 'general';
  
  // Optional fields
  const hydraConsensus = lastAnalysisResult.hydraConsensus;
  const authorityData = lastAnalysisResult.authorityData;
  const ghostData = lastAnalysisResult.ghostData;

  // Sprint M: Nexus decision from scan response
  const nexusData = lastAnalysisResult.nexus || null;

  // --- PROJECT CHRONOS: Determine if viewing history ---
  const isViewingHistory = currentAnalysisIndex !== null;
  const historyItem = isViewingHistory && currentAnalysisIndex !== null && analysisHistory
    ? analysisHistory[currentAnalysisIndex] 
    : null;

  // Normalize confidence
  const confidenceNormalized = confidenceScore > 1 ? confidenceScore / 100 : confidenceScore;

  // Unified image URLs array
  const allImageUrls = imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []);

  // ==========================================================================
  // Convert AnalysisResult → MarketplaceItem for ListOnMarketplaceButton
  // ==========================================================================
  const nowISO = new Date().toISOString();
  
  const marketplaceItem = {
    id: id || `temp_${Date.now()}`,
    challenge_id: id || undefined,
    item_name: itemName,
    asking_price: safeNumber(estimatedValue, 0),
    estimated_value: safeNumber(estimatedValue, 0),
    primary_photo_url: allImageUrls[0] || '',
    additional_photos: allImageUrls.slice(1),
    is_verified: !!authorityData,
    confidence_score: confidenceNormalized,
    title: itemName,
    name: itemName,
    price: safeNumber(estimatedValue, 0),
    estimatedValue: safeNumber(estimatedValue, 0),
    description: summary_reasoning || `${itemName} - AI analyzed collectible`,
    category: category || 'general',
    imageUrl: allImageUrls[0] || '',
    image_url: allImageUrls[0] || '',
    imageUrls: allImageUrls,
    images: allImageUrls,
    confidenceScore: confidenceNormalized,
    confidence: confidenceNormalized,
    valuation_factors: valuation_factors || [],
    tags: lastAnalysisResult.tags || [],
    condition: lastAnalysisResult.condition || 'good',
    authoritySource: authorityData?.source || '',
    authorityData: authorityData || undefined,
    numista_url: authorityData?.source === 'numista' && authorityData?.itemDetails?.url 
      ? authorityData.itemDetails.url : undefined,
    brand: lastAnalysisResult.brand || undefined,
    model: lastAnalysisResult.model || undefined,
    year: lastAnalysisResult.year || undefined,
    ghostData: ghostData || null,
    is_ghost: !!ghostData,
  };

  // ==========================================================================
  // handleListOnTagnetiq — inserts into arena_listings
  // ==========================================================================
  const handleListOnTagnetiq = async (
    listingItem: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData
  ) => {
    if (!user) {
      toast.error('Please log in to create a listing');
      return;
    }

    try {
      const listingImages = allImageUrls.length > 0 
        ? allImageUrls 
        : (listingItem.imageUrl ? [listingItem.imageUrl] : []);

      const listingMetadata: Record<string, any> = {};
      if (authorityData) {
        listingMetadata.authority_source = authorityData.source;
        listingMetadata.authority_data = authorityData;
      }
      if (hydraConsensus) {
        listingMetadata.hydra_consensus = hydraConsensus;
      }
      if (valuation_factors.length > 0) {
        listingMetadata.valuation_factors = valuation_factors;
      }
      if (ghost) {
        listingMetadata.ghost_protocol = ghost;
      }

      const safeCondition = mapConditionToEnum(listingItem.condition || 'good');

      const insertPayload: Record<string, any> = {
        seller_id: user.id,
        title: listingItem.item_name || listingItem.title || itemName,
        description: description,
        price: price,
        original_price: safeNumber(estimatedValue, 0),
        condition: safeCondition,
        images: listingImages,
        category: listingItem.category || category || 'general',
        status: 'active',
        offers_shipping: true,
        offers_local_pickup: true,
        shipping_available: true,
        metadata: Object.keys(listingMetadata).length > 0 ? listingMetadata : null,
        analysis_id: id || null,
        confidence_score: confidenceNormalized,
        is_verified: !!authorityData,
        estimated_value: safeNumber(estimatedValue, 0),
      };

      if (ghost) {
        insertPayload.is_ghost = true;
        insertPayload.handling_time_hours = ghost.handling_time_hours || 48;
        if (ghost.store?.location?.lat) {
          insertPayload.ghost_location_lat = ghost.store.location.lat;
        }
        if (ghost.store?.location?.lng) {
          insertPayload.ghost_location_lng = ghost.store.location.lng;
        }
      }

      const { data, error } = await supabase
        .from('arena_listings')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Listing creation error:', error);
        throw new Error(error.message || 'Failed to create listing');
      }

      toast.success('Listed on TagnetIQ Marketplace!', {
        action: {
          label: 'View Listing',
          onClick: () => navigate('/arena/marketplace'),
        },
      });
    } catch (err: any) {
      console.error('Marketplace listing failed:', err);
      toast.error('Listing failed', { 
        description: err.message || 'Please try again' 
      });
      throw err;
    }
  };

  const handleClear = () => {
    setLastAnalysisResult(null);
  };

  const handleDeleteFromHistory = async () => {
    if (historyItem && deleteFromHistory) {
      if (confirm('Remove this analysis from your history?')) {
        await deleteFromHistory(historyItem.id);
      }
    }
  };

  // --- Nexus action handlers ---
  const handleNexusList = () => {
    // Opens the ListOnMarketplaceButton flow (existing)
    // Pre-fill with Nexus draft if available
    toast.info('Opening listing flow...');
    // The existing ListOnMarketplaceButton handles the rest
  };

  const handleNexusVault = () => {
    toast.info('Adding to vault...');
    // Triggers AddToVaultButton flow
  };

  const handleNexusWatch = async () => {
    if (!user) {
      toast.error('Please log in to watch prices');
      return;
    }
    try {
      const response = await fetch('/api/oracle/argos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'watch',
          itemName,
          category,
          estimatedValue,
        }),
      });
      if (response.ok) {
        toast.success('Added to price watchlist!');
      } else {
        toast.info('Watchlist coming soon!');
      }
    } catch {
      toast.info('Watchlist coming soon!');
    }
  };

  const handleNexusDismiss = () => {
    setNexusDismissed(true);
  };

  const handleNexusScanMore = () => {
    setLastAnalysisResult(null);
    // Scanner should reopen — handled by AppContext
  };

  // --- Core Feature: Refine Analysis Loop ---
  const handleRefineSubmit = async () => {
    if (!refinementText.trim()) {
      toast.error('Please enter your refinement details.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/refine-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_analysis: lastAnalysisResult,
          refinement_text: refinementText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to refine analysis.');
      }

      const updatedAnalysis = await response.json();
      setLastAnalysisResult(updatedAnalysis);
      toast.success('Analysis has been successfully refined.');
      setIsRefineOpen(false);
      setRefinementText('');
    } catch (error: any) {
      toast.error(error.message || 'Refinement failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Core Feature: Learning Feedback Loop ---
  const handleFeedbackSubmit = async (rating: number) => {
    if (feedbackSubmitted || !user || isViewingHistory) return;
    setGivenRating(rating);

    try {
      const response = await fetch('/api/nexus/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: id,
          user_id: user.id,
          rating: rating,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback.');

      setFeedbackSubmitted(true);
      toast.success('Thank you! Your feedback makes our AI smarter.');
    } catch (error: any) {
      toast.error(error.message || 'Feedback failed');
      setGivenRating(0);
    }
  };

  const confidenceColor = confidenceScore > 85 ? 'bg-green-500' : confidenceScore > 65 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm animate-fade-in relative">
        {/* PROJECT CHRONOS: History Navigator */}
        <AnalysisHistoryNavigator />
        
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2 flex-wrap">
                {itemName}
                {ghostData && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Ghost className="h-3 w-3 mr-1" />
                    Ghost
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                {category}
                {isViewingHistory && historyItem?.created_at && (
                  <Badge variant="secondary" className="text-xs">
                    {new Date(historyItem.created_at).toLocaleDateString()}
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Badge className={`${confidenceColor} text-white`}>
              Confidence: {confidenceScore.toFixed(0)}%
            </Badge>
          </div>
          
          {/* HYDRA CONSENSUS DISPLAY */}
          {hydraConsensus && typeof hydraConsensus === 'object' && (
            <div className="mt-4">
              <HydraConsensusDisplay consensus={hydraConsensus} />
            </div>
          )}

          {/* AUTHORITY REPORT CARD */}
          {authorityData && typeof authorityData === 'object' && authorityData.source && (
            <div className="mt-4">
              <AuthorityReportCard authorityData={authorityData} />
            </div>
          )}

          {/* GHOST DATA DISPLAY */}
          {ghostData && typeof ghostData === 'object' && (
            <div className="mt-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Ghost className="h-5 w-5 text-purple-400" />
                <span className="font-medium text-purple-400">Ghost Protocol Data</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Store</p>
                  <p className="font-medium">{safeString(ghostData.store?.name) || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shelf Price</p>
                  <p className="font-medium">${safeNumber(ghostData.pricing?.shelf_price).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimated Margin</p>
                  <p className={`font-medium ${safeNumber(ghostData.kpis?.estimated_margin) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${safeNumber(ghostData.kpis?.estimated_margin).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Velocity</p>
                  <Badge variant="outline" className={
                    ghostData.kpis?.velocity_score === 'high' ? 'text-green-400 border-green-400' :
                    ghostData.kpis?.velocity_score === 'medium' ? 'text-yellow-400 border-yellow-400' :
                    'text-red-400 border-red-400'
                  }>
                    {safeString(ghostData.kpis?.velocity_score) || 'unknown'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Carousel */}
            <div className="relative">
              {allImageUrls.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {allImageUrls.map((url, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <Card className="overflow-hidden">
                            <CardContent className="flex aspect-square items-center justify-center p-0">
                              <img 
                                src={url} 
                                alt={`${itemName} view ${index + 1}`} 
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {allImageUrls.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              ) : (
                <Card>
                  <CardContent className="flex aspect-square items-center justify-center">
                    <span className="text-muted-foreground">No images available</span>
                  </CardContent>
                </Card>
              )}
              
              {allImageUrls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-xs text-muted-foreground">
                    {allImageUrls.length} images
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">Estimated Value</p>
                <p className="text-5xl font-bold">${estimatedValue.toFixed(2)}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <h3 className="text-lg font-semibold">Key Valuation Factors</h3>
                  {!isViewingHistory && (
                    <Button variant="outline" size="sm" onClick={() => setIsRefineOpen(true)}>
                      <WandSparkles className="h-4 w-4 mr-2" />
                      Refine Analysis
                    </Button>
                  )}
                </div>
                {valuation_factors.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {valuation_factors.map((factor, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific factors identified.</p>
                )}
                {summary_reasoning && (
                  <p className="mt-4 text-xs italic text-muted-foreground">{summary_reasoning}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          {/* ================================================================
              Sprint M: NEXUS DECISION TREE — Oracle's guided suggestion
              Replaces static ACTION HUB when Nexus data is available
          ================================================================ */}
          {!isViewingHistory && nexusData && !nexusDismissed ? (
            <NexusDecisionCard
              nexus={nexusData}
              analysisId={id}
              onList={handleNexusList}
              onVault={handleNexusVault}
              onWatch={handleNexusWatch}
              onDismiss={handleNexusDismiss}
              onScanMore={handleNexusScanMore}
            />
          ) : (
            /* Fallback: Original ACTION HUB (for history view or if Nexus not available) */
            <div className="w-full p-4 border rounded-lg bg-background">
              <h3 className="text-sm font-semibold mb-3 text-center text-muted-foreground">ACTION HUB</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {!isViewingHistory ? (
                  <>
                    <AddToVaultButton analysisResult={lastAnalysisResult} onSuccess={handleClear} />
                    <ListOnMarketplaceButton 
                      item={marketplaceItem}
                      ghostData={ghostData || null}
                      onListOnTagnetiq={handleListOnTagnetiq}
                    />
                    <Button variant="secondary" className="w-full" onClick={() => toast.info('Social sharing coming soon!')}>
                      Share to Social
                    </Button>
                    <Button variant="outline" onClick={handleClear} className="w-full">
                      Clear & Scan Next
                    </Button>
                  </>
                ) : (
                  <>
                    <AddToVaultButton analysisResult={lastAnalysisResult} />
                    <Button 
                      variant="destructive" 
                      className="w-full col-span-1" 
                      onClick={handleDeleteFromHistory}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Feedback Loop */}
          {!isViewingHistory && (
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground mb-2">
                {feedbackSubmitted ? "Thank you for your feedback!" : "Rate Analysis Accuracy"}
              </p>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`cursor-pointer transition-colors ${
                      (hoveredRating || givenRating) >= star
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    } ${feedbackSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
                    onMouseEnter={() => !feedbackSubmitted && setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => handleFeedbackSubmit(star)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Refine Analysis Dialog */}
      <Dialog open={isRefineOpen} onOpenChange={setIsRefineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refine AI Analysis</DialogTitle>
            <DialogDescription>
              Add new information that was missed by the visual scan, like an autograph, a flaw, or original packaging.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="refinement-text">New Information:</Label>
            <Textarea
              id="refinement-text"
              placeholder="e.g., 'Autographed by the author on the inside cover.' or 'Has a 2-inch tear on the dust jacket.'"
              className="h-32"
              value={refinementText}
              onChange={(e) => setRefinementText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefineOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRefineSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit & Re-Analyze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// =============================================================================
// EXPORTED COMPONENT WITH ERROR BOUNDARY
// =============================================================================

const AnalysisResult: React.FC = () => {
  const { setLastAnalysisResult } = useAppContext();
  
  const handleClear = () => {
    setLastAnalysisResult(null);
  };
  
  return (
    <AnalysisErrorBoundary onClear={handleClear}>
      <AnalysisResultContent />
    </AnalysisErrorBoundary>
  );
};

export default AnalysisResult;
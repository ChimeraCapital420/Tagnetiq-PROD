// FILE: src/components/AnalysisResult.tsx
// STATUS: Chronos-enhanced with time-travel UI and multi-image carousel - COMPLETE VERSION

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddToVaultButton } from './vault/AddToVaultButton.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, Star, WandSparkles, Loader2, Shield, Trash2 } from 'lucide-react';
import { HydraConsensusDisplay } from './HydraConsensusDisplay.js';
import { AnalysisHistoryNavigator } from './AnalysisHistoryNavigator.js';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const AnalysisResult: React.FC = () => {
  const { 
    lastAnalysisResult, 
    setLastAnalysisResult,
    currentAnalysisIndex,
    analysisHistory,
    deleteFromHistory
  } = useAppContext();
  const { user } = useAuth();

  // --- Nexus State Management ---
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [givenRating, setGivenRating] = useState(0);

  if (!lastAnalysisResult) {
    return null;
  }

  const {
    id,
    itemName,
    estimatedValue,
    confidenceScore,
    summary_reasoning,
    valuation_factors,
    imageUrl,
    category,
  } = lastAnalysisResult;

  // --- PROJECT CHRONOS: Determine if viewing history ---
  const isViewingHistory = currentAnalysisIndex !== null;
  const historyItem = isViewingHistory ? analysisHistory[currentAnalysisIndex] : null;

  const handleClear = () => {
    setLastAnalysisResult(null);
  };

  // --- PROJECT CHRONOS: Delete from history ---
  const handleDeleteFromHistory = async () => {
    if (historyItem) {
      if (confirm('Remove this analysis from your history?')) {
        await deleteFromHistory(historyItem.id);
      }
    }
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refine analysis.');
      }

      const updatedAnalysis = await response.json();
      setLastAnalysisResult(updatedAnalysis);
      toast.success('Analysis has been successfully refined.');
      setIsRefineOpen(false);
      setRefinementText('');
    } catch (error: any) {
      toast.error(error.message);
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
      toast.error(error.message);
      setGivenRating(0); // Reset on error
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
              <CardTitle className="text-2xl">{itemName}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                {category}
                {isViewingHistory && historyItem && (
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
          {lastAnalysisResult.hydraConsensus && (
            <div className="mt-4">
              <HydraConsensusDisplay consensus={lastAnalysisResult.hydraConsensus} />
            </div>
          )}

          {/* AUTHORITY VERIFICATION DISPLAY - COMPLETE VERSION */}
          {lastAnalysisResult.authorityData && (
            <Card className="mt-4 border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">
                    Verified by {lastAnalysisResult.authorityData.source}
                  </CardTitle>
                  <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
                    Authority Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Book Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {lastAnalysisResult.authorityData.isbn && (
                    <div>
                      <p className="text-muted-foreground">ISBN</p>
                      <p className="font-mono font-semibold">
                        {lastAnalysisResult.authorityData.isbn}
                      </p>
                    </div>
                  )}
                  {lastAnalysisResult.authorityData.authors && (
                    <div>
                      <p className="text-muted-foreground">Author(s)</p>
                      <p className="font-semibold">
                        {lastAnalysisResult.authorityData.authors.join(', ')}
                      </p>
                    </div>
                  )}
                  {lastAnalysisResult.authorityData.publisher && (
                    <div>
                      <p className="text-muted-foreground">Publisher</p>
                      <p>{lastAnalysisResult.authorityData.publisher}</p>
                    </div>
                  )}
                  {lastAnalysisResult.authorityData.publishedDate && (
                    <div>
                      <p className="text-muted-foreground">Published</p>
                      <p>{lastAnalysisResult.authorityData.publishedDate}</p>
                    </div>
                  )}
                  {lastAnalysisResult.authorityData.pageCount > 0 && (
                    <div>
                      <p className="text-muted-foreground">Pages</p>
                      <p>{lastAnalysisResult.authorityData.pageCount}</p>
                    </div>
                  )}
                  {lastAnalysisResult.authorityData.retailPrice && (
                    <div>
                      <p className="text-muted-foreground">Retail Price</p>
                      <p className="font-semibold">
                        ${lastAnalysisResult.authorityData.retailPrice.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Categories */}
                {lastAnalysisResult.authorityData.categories && 
                 lastAnalysisResult.authorityData.categories.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-1">Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {lastAnalysisResult.authorityData.categories.slice(0, 3).map((cat, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Market Values */}
                {lastAnalysisResult.authorityData.marketValue && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-semibold mb-2">Market Values by Condition</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-background">
                        <p className="text-xs text-muted-foreground">Good</p>
                        <p className="font-bold text-sm">
                          ${lastAnalysisResult.authorityData.marketValue.good}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-background">
                        <p className="text-xs text-muted-foreground">Very Good</p>
                        <p className="font-bold text-sm">
                          ${lastAnalysisResult.authorityData.marketValue.veryGood}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-background">
                        <p className="text-xs text-muted-foreground">Like New</p>
                        <p className="font-bold text-sm">
                          ${lastAnalysisResult.authorityData.marketValue.likeNew}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-background">
                        <p className="text-xs text-muted-foreground">New</p>
                        <p className="font-bold text-sm">
                          ${lastAnalysisResult.authorityData.marketValue.new}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Authority Source Link */}
                <div className="pt-2 text-xs text-center text-muted-foreground">
                  Data provided by {lastAnalysisResult.authorityData.source}
                  {lastAnalysisResult.authorityData.isbn && (
                    <span>
                      {' • '}
                      <a 
                        href={`https://openlibrary.org/isbn/${lastAnalysisResult.authorityData.isbn}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View on Open Library
                      </a>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PROJECT CHRONOS: Enhanced Image Carousel */}
            <div className="relative">
              {lastAnalysisResult.imageUrls && lastAnalysisResult.imageUrls.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {lastAnalysisResult.imageUrls.map((url, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <Card className="overflow-hidden">
                            <CardContent className="flex aspect-square items-center justify-center p-0">
                              <img 
                                src={url} 
                                alt={`${itemName} view ${index + 1}`} 
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </CardContent>
                          </Card>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {lastAnalysisResult.imageUrls.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              ) : imageUrl ? (
                <Card className="overflow-hidden">
                  <CardContent className="flex aspect-square items-center justify-center p-0">
                    <img 
                      src={imageUrl} 
                      alt={itemName} 
                      className="w-full h-full object-cover"
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex aspect-square items-center justify-center">
                    <span className="text-muted-foreground">No images available</span>
                  </CardContent>
                </Card>
              )}
              
              {lastAnalysisResult.imageUrls && lastAnalysisResult.imageUrls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-xs text-muted-foreground">
                    {lastAnalysisResult.imageUrls.length} images
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
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Key Valuation Factors</h3>
                  {!isViewingHistory && (
                    <Button variant="outline" size="sm" onClick={() => setIsRefineOpen(true)}>
                      <WandSparkles className="h-4 w-4 mr-2" />
                      Refine Analysis
                    </Button>
                  )}
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {valuation_factors.map((factor, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs italic text-muted-foreground">{summary_reasoning}</p>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          {/* --- Core Feature: Action Hub --- */}
          <div className="w-full p-4 border rounded-lg bg-background">
            <h3 className="text-sm font-semibold mb-3 text-center text-muted-foreground">ACTION HUB</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {!isViewingHistory ? (
                <>
                  <AddToVaultButton analysisResult={lastAnalysisResult} onSuccess={handleClear} />
                  <Button variant="secondary" className="w-full" onClick={() => toast.info('Marketplace listing coming soon!')}>
                    List on Marketplace
                  </Button>
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
                    Delete from History
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* --- Core Feature: Learning Feedback Loop --- */}
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

      {/* --- Refine Analysis Dialog --- */}
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

export default AnalysisResult;
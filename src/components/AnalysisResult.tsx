// FILE: src/components/AnalysisResult.tsx
// STATUS: Hydra-enhanced with multi-AI consensus display

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddToVaultButton } from './vault/AddToVaultButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, Star, WandSparkles, Loader2 } from 'lucide-react';
import { HydraConsensusDisplay } from './HydraConsensusDisplay';

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult } = useAppContext();
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

  const handleClear = () => {
    setLastAnalysisResult(null);
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
    if (feedbackSubmitted || !user) return;
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
      <Card className="w-full max-w-4xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{itemName}</CardTitle>
              <CardDescription>{category}</CardDescription>
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
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <img
              src={imageUrl || '/placeholder.svg'}
              alt={itemName}
              className="rounded-lg object-cover aspect-square w-full"
            />
            <div className="space-y-6">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">Estimated Value</p>
                <p className="text-5xl font-bold">${estimatedValue.toFixed(2)}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Key Valuation Factors</h3>
                  <Button variant="outline" size="sm" onClick={() => setIsRefineOpen(true)}>
                    <WandSparkles className="h-4 w-4 mr-2" />
                    Refine Analysis
                  </Button>
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
            </div>
          </div>
          
          {/* --- Core Feature: Learning Feedback Loop --- */}
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
// FILE: src/components/analysis/hooks/useFeedback.ts
// Handles feedback star ratings and refinement text submission.
// Extracted from AnalysisResult.tsx monolith.
//
// v1.1: SECURITY — Added Bearer auth to refine-analysis call
//       (server now requires verifyUser)

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';

export function useFeedback(analysisId: string, isViewingHistory: boolean) {
  const { user, session } = useAuth();
  const { lastAnalysisResult, setLastAnalysisResult } = useAppContext();

  // ── Star Rating ────────────────────────────────────────
  const [hoveredRating, setHoveredRating] = useState(0);
  const [givenRating, setGivenRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const submitRating = useCallback(async (rating: number) => {
    if (feedbackSubmitted || !user || isViewingHistory) return;
    setGivenRating(rating);

    try {
      const response = await fetch('/api/nexus/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ analysis_id: analysisId, user_id: user.id, rating }),
      });
      if (!response.ok) throw new Error('Failed to submit feedback.');
      setFeedbackSubmitted(true);
      toast.success('Thank you! Your feedback makes our AI smarter.');
    } catch (err: any) {
      toast.error(err.message || 'Feedback failed');
      setGivenRating(0);
    }
  }, [feedbackSubmitted, user, session, isViewingHistory, analysisId]);

  // ── Refine Analysis ────────────────────────────────────
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [isRefineSubmitting, setIsRefineSubmitting] = useState(false);

  const submitRefinement = useCallback(async () => {
    if (!refinementText.trim()) {
      toast.error('Please enter your refinement details.');
      return;
    }

    setIsRefineSubmitting(true);
    try {
      const response = await fetch('/api/refine-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // v1.1: Bearer auth required — server now calls verifyUser()
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
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
    } catch (err: any) {
      toast.error(err.message || 'Refinement failed');
    } finally {
      setIsRefineSubmitting(false);
    }
  }, [refinementText, lastAnalysisResult, setLastAnalysisResult, session]);

  return {
    // Rating
    hoveredRating,
    setHoveredRating,
    givenRating,
    feedbackSubmitted,
    submitRating,
    // Refine
    isRefineOpen,
    setIsRefineOpen,
    refinementText,
    setRefinementText,
    isRefineSubmitting,
    submitRefinement,
  };
}
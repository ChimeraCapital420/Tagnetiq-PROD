// FILE: src/components/scanner/hooks/useAnalysisSubmit.ts
// Extracted from DualScanner.tsx — handles the entire analysis submission flow
// v3.2: Healing haptics integration — fires tier-aware feedback on every SSE event
//
// - SSE streaming from /api/analyze-stream with real-time progress
// - Fallback to /api/analyze if streaming fails
// - Data shape normalization (fixes hydraConsensus.votes crash)
// - Ghost mode data injection
// - Device-side payload compression before upload (mobile-first)
// - Healing haptics synced to each SSE event (zero extra timers)

import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '../utils/compression';
import type { CapturedItem } from '../types';
import type { ScanProgress } from '@/contexts/AppContext';
import type { UseHealingHapticsReturn } from './useHealingHaptics';

// =============================================================================
// TYPES
// =============================================================================

export interface UseAnalysisSubmitOptions {
  /** Ghost mode hook return */
  ghostMode: {
    isGhostMode: boolean;
    isReady: boolean;
    buildGhostData: (estimatedValue: number) => any | null;
  };
  /** Healing haptics hook return (optional — degrades gracefully) */
  haptics?: UseHealingHapticsReturn;
  /** Callback after successful analysis */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseAnalysisSubmitReturn {
  /** Submit selected items for analysis */
  handleAnalyze: (selectedItems: CapturedItem[]) => Promise<void>;
  /** Abort any in-progress analysis */
  abort: () => void;
  /** Whether currently submitting */
  isSubmitting: boolean;
}

interface SSEEvent {
  type: string;
  timestamp: number;
  data: any;
}

// =============================================================================
// SSE STREAM PARSER
// Reads Server-Sent Events from /api/analyze-stream
// =============================================================================

async function readSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // Skip malformed events — don't crash the stream
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// NORMALIZE ANALYSIS RESULT
// Ensures hydraConsensus.votes always exists regardless of API shape
// This is the fix for the HydraConsensusDisplay crash
// =============================================================================

function normalizeAnalysisResult(raw: any): any {
  if (!raw) return raw;

  // Ensure hydraConsensus has a votes array
  if (raw.hydraConsensus) {
    const hc = raw.hydraConsensus;

    // votes might be under votes, allVotes, or missing entirely
    const votes = hc.votes || hc.allVotes || [];

    // Normalize each vote to the shape display components expect
    const normalizedVotes = votes.map((v: any) => ({
      providerName: v.providerName || v.model || 'Unknown',
      icon: v.icon || '🤖',
      color: v.color || '#888',
      success: v.success ?? true,
      weight: v.weight ?? 1,
      responseTime: v.responseTime || 0,
      estimatedValue: v.estimatedValue ?? v.rawResponse?.estimatedValue ?? 0,
      decision: v.decision ?? v.rawResponse?.decision ?? 'SELL',
      confidence: v.confidence ?? v.rawResponse?.confidence ?? 0.5,
      category: v.category ?? v.rawResponse?.category ?? raw.category ?? 'general',
      itemName: v.itemName ?? v.rawResponse?.itemName ?? raw.itemName ?? 'Unknown Item',
      rawResponse: v.rawResponse || null,
    }));

    raw.hydraConsensus = {
      ...hc,
      votes: normalizedVotes,
      allVotes: normalizedVotes,
    };
  }

  // Ensure top-level fields exist
  raw.valuation_factors = raw.valuation_factors || [];
  raw.summary_reasoning = raw.summary_reasoning || 'Analysis complete';
  raw.marketComps = raw.marketComps || [];
  raw.resale_toolkit = raw.resale_toolkit || {
    listInArena: true,
    sellOnProPlatforms: true,
    linkToMyStore: false,
    shareToSocial: true,
  };

  return raw;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAnalysisSubmit(
  options: UseAnalysisSubmitOptions
): UseAnalysisSubmitReturn {
  const { ghostMode, haptics, onComplete, onError } = options;
  const {
    setLastAnalysisResult,
    setIsAnalyzing,
    selectedCategory,
    setScanProgress,
  } = useAppContext();
  const { session } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // SSE EVENT HANDLER — Maps stream events to scanProgress + haptics
  // Haptics fire at the EXACT moment each visual event occurs — perfectly synced
  // ---------------------------------------------------------------------------
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'init':
          setScanProgress({
            stage: 'identifying',
            message: 'Initializing analysis engine...',
            aiModels: (event.data.models || []).map((m: any) => ({
              name: m.name,
              icon: m.icon,
              color: m.color,
              status: 'waiting' as const,
            })),
            modelsComplete: 0,
            modelsTotal: event.data.totalModels || 7,
            currentEstimate: 0,
            confidence: 0,
            category: null,
            marketApis: [],
          });
          // Haptic: analysis engine acknowledged
          haptics?.analysisStart();
          break;

        case 'phase': {
          const stageMap: Record<string, ScanProgress['stage']> = {
            ai: 'ai_consensus',
            market: 'market_data',
            finalizing: 'finalizing',
          };
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: stageMap[event.data.phase] || prev.stage,
                  message: event.data.message || prev.message,
                  marketApis: event.data.apis || prev.marketApis,
                }
              : prev
          );
          // Haptic: phase transition — distinct rhythm per phase (Pro+)
          haptics?.phaseTransition(event.data.phase);
          break;
        }

        case 'ai_start':
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: 'ai_consensus',
                  aiModels: prev.aiModels.map((m) =>
                    m.name === event.data.model
                      ? { ...m, status: 'thinking' as const }
                      : m
                  ),
                }
              : prev
          );
          // Haptic: barely-there tick — "I see a dot light up" (Pro+)
          haptics?.aiModelStart(event.data.index ?? 0);
          break;

        case 'ai_complete':
          setScanProgress((prev) => {
            if (!prev) return prev;
            const newModels = prev.aiModels.map((m) =>
              m.name === event.data.model
                ? {
                    ...m,
                    status: (event.data.success
                      ? 'complete'
                      : 'error') as 'complete' | 'error',
                    estimate: event.data.estimate,
                    decision: event.data.decision,
                    responseTime: event.data.responseTime,
                    weight: event.data.weight,
                  }
                : m
            );
            return {
              ...prev,
              aiModels: newModels,
              modelsComplete: newModels.filter(
                (m) => m.status === 'complete' || m.status === 'error'
              ).length,
            };
          });
          // Haptic: model reported in — different feel for success vs failure (Pro+)
          haptics?.aiModelComplete(event.data.success ?? true);
          break;

        case 'price':
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  currentEstimate: event.data.estimate,
                  confidence: event.data.confidence,
                }
              : prev
          );
          // Haptic: money pulse + heartbeat intensity sync (Oracle)
          haptics?.priceUpdate(event.data.confidence ?? 0);
          haptics?.heartbeat(event.data.confidence ?? 0);
          break;

        case 'category':
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  category: event.data.displayName || event.data.category,
                }
              : prev
          );
          break;

        case 'api_start':
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: 'market_data',
                  message: `Checking ${event.data.api}...`,
                }
              : prev
          );
          // Haptic: subtle tick — "checking another source" (Pro+)
          haptics?.marketApiStart();
          break;

        case 'api_complete': {
          const msg = event.data.success
            ? `${event.data.api}: ${event.data.listings || 0} listings found`
            : `${event.data.api}: unavailable`;
          setScanProgress((prev) =>
            prev ? { ...prev, message: msg } : prev
          );
          // Haptic: data arrived (Pro+)
          haptics?.marketApiComplete(event.data.success ?? false);
          break;
        }

        case 'complete':
          setScanProgress((prev) =>
            prev
              ? { ...prev, stage: 'complete', message: 'Analysis complete' }
              : prev
          );
          // Haptic: THE reward moment — decision-aware on Oracle tier
          haptics?.analysisComplete(event.data?.decision || 'SELL');
          break;

        case 'error':
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: 'error',
                  message: event.data.message || 'Analysis failed',
                  error: event.data.message,
                }
              : prev
          );
          // Haptic: unmistakable error — all tiers
          haptics?.analysisError();
          break;
      }
    },
    [setScanProgress, haptics]
  );

  // ---------------------------------------------------------------------------
  // MAIN ANALYSIS SUBMISSION
  // ---------------------------------------------------------------------------
  const handleAnalyze = useCallback(
    async (selectedItems: CapturedItem[]) => {
      if (selectedItems.length === 0) {
        toast.error('Select at least one item');
        return;
      }

      if (!session?.access_token || !session?.user?.id) {
        toast.error('Please sign in');
        return;
      }

      if (ghostMode.isGhostMode && !ghostMode.isReady) {
        toast.error('Complete ghost listing details', {
          description: 'Enter store name and shelf price',
        });
        return;
      }

      // Abort any previous analysis
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      isSubmittingRef.current = true;

      setIsAnalyzing(true);

      // Initialize scan progress
      setScanProgress({
        stage: 'preparing',
        message: ghostMode.isGhostMode
          ? '👻 Preparing ghost analysis...'
          : `Preparing ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}...`,
        aiModels: [],
        modelsComplete: 0,
        modelsTotal: 7,
        currentEstimate: 0,
        confidence: 0,
        category: null,
        marketApis: [],
      });

      try {
        // =================================================================
        // STEP 1: Device-side compression (mobile-first — reduce upload)
        // =================================================================
        setScanProgress((prev) =>
          prev
            ? { ...prev, stage: 'preparing', message: 'Compressing images...' }
            : prev
        );

        const originalImageUrls: string[] = [];
        let totalPayloadSize = 0;

        const processedItems = await Promise.all(
          selectedItems.map(async (item) => {
            let processedData = item.data;

            // Compress photos for API (keep originals for marketplace images)
            if (item.type === 'photo' && item.data) {
              originalImageUrls.push(item.originalData || item.data);

              const currentSize = Math.round((item.data.length * 3) / 4);
              if (currentSize > 2 * 1024 * 1024) {
                console.log(
                  `⚠️ Re-compressing large image: ${(currentSize / 1024 / 1024).toFixed(1)}MB`
                );
                const result = await compressImage(processedData, {
                  maxSizeMB: 1.5,
                  quality: 0.75,
                });
                processedData = result.compressed;
              }
            }

            totalPayloadSize += processedData.length;

            return {
              type: item.type,
              name: item.name,
              data: processedData,
              metadata: {
                ...item.metadata,
                extractedText: item.metadata?.extractedText || '',
                barcodes: item.metadata?.barcodes || [],
              },
            };
          })
        );

        const estimatedBytes = (totalPayloadSize * 3) / 4;
        if (estimatedBytes > 4 * 1024 * 1024) {
          toast.warning(
            `Large payload (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB). Analysis may take longer.`
          );
        }

        // =================================================================
        // STEP 2: Build request payload
        // =================================================================
        const requestPayload = {
          scanType: processedItems.length > 1 ? 'multi-modal' : 'image',
          items: processedItems,
          data: processedItems.length === 1 ? processedItems[0].data : undefined,
          category_id: selectedCategory?.split('-')[0] || 'general',
          subcategory_id: selectedCategory || 'general',
          ghost: ghostMode.isGhostMode ? ghostMode.buildGhostData(0) : undefined,
          originalImageUrls,
        };

        // =================================================================
        // STEP 3: Try SSE streaming first, fallback to standard
        // =================================================================
        let analysisResult: any = null;

        try {
          const streamResponse = await fetch('/api/analyze-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(requestPayload),
            signal: abortRef.current.signal,
          });

          if (streamResponse.ok && streamResponse.body) {
            await readSSEStream(
              streamResponse,
              (event) => {
                handleSSEEvent(event);
                if (event.type === 'complete') {
                  analysisResult = event.data;
                }
              },
              abortRef.current.signal
            );
          }
        } catch (streamError: any) {
          if (streamError.name === 'AbortError') throw streamError;
          console.warn(
            'Streaming failed, falling back:',
            streamError.message
          );
        }

        // Fallback to standard /api/analyze
        if (!analysisResult) {
          setScanProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: 'ai_consensus',
                  message: 'Analyzing your item...',
                }
              : prev
          );

          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(requestPayload),
            signal: abortRef.current.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (
              response.status === 413 ||
              errorText.includes('PAYLOAD_TOO_LARGE')
            ) {
              throw new Error('Image too large. Try a smaller image.');
            }
            throw new Error(`Analysis failed: ${response.status}`);
          }

          analysisResult = await response.json();

          // Fallback path doesn't get SSE events, so fire completion haptic here
          haptics?.analysisComplete(analysisResult?.decision || 'SELL');
        }

        // =================================================================
        // STEP 4: Normalize result shape (prevents display crashes)
        // =================================================================
        analysisResult = normalizeAnalysisResult(analysisResult);

        // Inject ghost data
        const ghostData = ghostMode.isGhostMode
          ? ghostMode.buildGhostData(analysisResult.estimatedValue || 0)
          : null;

        // Signal completion
        setScanProgress((prev) =>
          prev
            ? { ...prev, stage: 'complete', message: 'Analysis complete' }
            : prev
        );

        // Brief pause so user sees completion state
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Set the result — this triggers the display components
        setLastAnalysisResult({
          ...analysisResult,
          id: analysisResult.id || uuidv4(),
          imageUrls:
            originalImageUrls.length > 0
              ? originalImageUrls
              : selectedItems.map((item) => item.thumbnail),
          ghost: ghostData,
        });

        if (ghostData) {
          toast.success(
            `👻 Ghost analysis: $${analysisResult.estimatedValue?.toFixed(2)}`
          );
        } else {
          toast.success('Analysis complete!');
        }

        onComplete?.();
      } catch (error: any) {
        if (error.name === 'AbortError') return;

        console.error('Analysis error:', error);
        toast.error(error.message || 'Analysis failed');
        onError?.(error.message);

        // Haptic: error feedback (all tiers)
        haptics?.analysisError();

        setScanProgress((prev) =>
          prev
            ? {
                ...prev,
                stage: 'error',
                message: error.message || 'Analysis failed',
                error: error.message,
              }
            : prev
        );
      } finally {
        isSubmittingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      session,
      ghostMode,
      haptics,
      selectedCategory,
      setIsAnalyzing,
      setScanProgress,
      setLastAnalysisResult,
      handleSSEEvent,
      onComplete,
      onError,
    ]
  );

  // ---------------------------------------------------------------------------
  // ABORT
  // ---------------------------------------------------------------------------
  const abort = useCallback(() => {
    abortRef.current?.abort();
    isSubmittingRef.current = false;
  }, []);

  return {
    handleAnalyze,
    abort,
    isSubmitting: isSubmittingRef.current,
  };
}

export default useAnalysisSubmit;
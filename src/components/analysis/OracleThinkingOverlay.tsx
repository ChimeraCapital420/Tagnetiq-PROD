// FILE: src/components/analysis/OracleThinkingOverlay.tsx
// STATUS: Oracle Thinking Experience v1.0
// PURPOSE: Replace the dead 15-second screen with an engaging, informative overlay
//
// DESIGN PRINCIPLES:
//   1. CSS-only animations (GPU-composited, no canvas, no rAF loops)
//   2. Three engagement modes: ambient, guided, conversational
//   3. Respects prefers-reduced-motion and battery constraints
//   4. Reads real SSE progress from AppContext.scanProgress
//   5. Mobile-first: full viewport, touch-friendly, minimal battery draw
//
// ARCHITECTURE:
//   - Renders when isAnalyzing === true
//   - Reads scanProgress from AppContext for real-time SSE data
//   - oracleEngagement mode controls verbosity level
//   - Auto-dismisses when analysis completes (scanProgress.stage === 'complete')

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import './OracleThinkingOverlay.css';

// =============================================================================
// TYPES
// =============================================================================

type EngagementMode = 'ambient' | 'guided' | 'conversational';

interface OracleModelStatus {
  name: string;
  icon: string;
  color: string;
  status: 'waiting' | 'thinking' | 'complete' | 'error';
  estimate?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STAGE_LABELS: Record<string, string> = {
  preparing: 'Preparing analysis...',
  identifying: 'Examining your item...',
  ai_consensus: 'Building AI consensus...',
  market_data: 'Checking live market data...',
  finalizing: 'Finalizing valuation...',
  complete: 'Analysis complete',
  error: 'Something went wrong',
};

// Oracle personality lines for conversational mode — grouped by stage
const ORACLE_LINES: Record<string, string[]> = {
  preparing: [
    "Let me take a closer look at this...",
    "Interesting. Give me a moment to examine the details.",
    "I can see the details clearly. Analyzing now.",
    "Got it. Let me pull up everything I know.",
  ],
  identifying: [
    "I'm picking up on some distinctive features here.",
    "Running this through my visual recognition systems.",
    "The details are coming into focus. One moment.",
    "I've seen items like this before. Let me confirm.",
  ],
  ai_consensus: [
    "Consulting my network of specialists on this one.",
    "Several appraisal models are weighing in now.",
    "The estimates are converging. Looking promising.",
    "Getting strong agreement across my sources.",
    "Almost there — just waiting on a few more opinions.",
  ],
  market_data: [
    "Now let's see what the market actually says.",
    "Cross-referencing with recent sales data...",
    "Found some comparable listings. Crunching numbers.",
    "Real market data is the real test. Checking now.",
    "The market data will sharpen this estimate nicely.",
  ],
  finalizing: [
    "Pulling it all together for you.",
    "Just dotting the i's on this one.",
    "Almost ready. Building your full report.",
    "Final checks complete. Here's what I found.",
  ],
};

// Fun facts shown in guided + conversational mode
const FUN_FACTS = [
  "Condition is the single biggest factor in collectible value.",
  "Items with original packaging can be worth 2-5x more.",
  "The collectibles market grew 25% in 2023.",
  "Authentication can double an item's resale value.",
  "Estate items are often undervalued by 40-60%.",
  "Provenance — proof of origin — can add 50%+ to value.",
  "Rarity matters less than demand for pricing.",
  "The best time to sell collectibles is when nostalgia peaks.",
];

// =============================================================================
// HELPER: Elapsed timer hook
// =============================================================================

function useElapsedTime(isActive: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return elapsed;
}

// =============================================================================
// HELPER: Cycling text hook
// =============================================================================

function useCyclingText(texts: string[], intervalMs: number, isActive: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive || texts.length === 0) return;
    setIndex(Math.floor(Math.random() * texts.length));
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % texts.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [texts, intervalMs, isActive]);

  return texts[index] || '';
}

// =============================================================================
// SUB-COMPONENT: Cymatic Rings (CSS-only, GPU-composited)
// =============================================================================

const CymaticRings: React.FC<{ intensity: number; stage: string }> = ({ intensity, stage }) => {
  // Map stage to color accent
  const accentColor = useMemo(() => {
    switch (stage) {
      case 'ai_consensus': return '168, 85, 247';   // purple
      case 'market_data': return '59, 130, 246';     // blue
      case 'finalizing': return '16, 185, 129';      // green
      case 'complete': return '16, 185, 129';        // green
      case 'error': return '239, 68, 68';            // red
      default: return '0, 200, 255';                 // cyan
    }
  }, [stage]);

  return (
    <div
      className="cymatic-container"
      style={{ '--cymatic-rgb': accentColor, '--cymatic-intensity': intensity } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* 6 concentric rings with staggered animations */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="cymatic-ring"
          style={{
            '--ring-index': i,
            '--ring-size': `${20 + i * 14}%`,
            '--ring-duration': `${3 + i * 0.7}s`,
            '--ring-delay': `${i * -0.4}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Central glow orb */}
      <div className="cymatic-core" />
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Progress Ring (CSS conic-gradient)
// =============================================================================

const ProgressRing: React.FC<{ progress: number; size?: number }> = ({ progress, size = 140 }) => {
  return (
    <div
      className="progress-ring"
      style={{
        '--progress': Math.min(progress, 100),
        '--ring-size': `${size}px`,
      } as React.CSSProperties}
    >
      <div className="progress-ring-inner">
        <span className="progress-ring-text">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: AI Model Dots (compact mobile view)
// =============================================================================

const AIModelDots: React.FC<{ models: OracleModelStatus[] }> = ({ models }) => {
  if (!models || models.length === 0) return null;

  return (
    <div className="model-dots-row">
      {models.map((model) => (
        <div
          key={model.name}
          className={`model-dot model-dot--${model.status}`}
          style={{ '--dot-color': model.color } as React.CSSProperties}
          title={`${model.name}: ${model.status}${model.estimate ? ` — $${model.estimate.toFixed(2)}` : ''}`}
        >
          <span className="model-dot-icon">{model.icon}</span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Engagement Mode Toggle
// =============================================================================

const EngagementToggle: React.FC<{
  mode: EngagementMode;
  onChange: (mode: EngagementMode) => void;
}> = ({ mode, onChange }) => {
  const modes: { key: EngagementMode; label: string }[] = [
    { key: 'ambient', label: 'Zen' },
    { key: 'guided', label: 'Guided' },
    { key: 'conversational', label: 'Oracle' },
  ];

  return (
    <div className="engagement-toggle">
      {modes.map(m => (
        <button
          key={m.key}
          className={`engagement-toggle-btn ${mode === m.key ? 'engagement-toggle-btn--active' : ''}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const OracleThinkingOverlay: React.FC = () => {
  const {
    isAnalyzing,
    scanProgress,
    oracleEngagement,
    setOracleEngagement,
  } = useAppContext();

  const elapsed = useElapsedTime(isAnalyzing);

  // Determine current stage from scanProgress or fall back
  const stage = scanProgress?.stage || 'preparing';
  const stageMessage = scanProgress?.message || STAGE_LABELS[stage] || 'Analyzing...';

  // Oracle conversational lines
  const oracleLines = ORACLE_LINES[stage] || ORACLE_LINES.preparing;
  const oracleLine = useCyclingText(oracleLines, 4000, isAnalyzing && oracleEngagement === 'conversational');

  // Fun facts for guided + conversational
  const funFact = useCyclingText(FUN_FACTS, 5000, isAnalyzing && oracleEngagement !== 'ambient');

  // Calculate progress percentage from scan stages
  const progressPercent = useMemo(() => {
    const stageWeights: Record<string, number> = {
      preparing: 5,
      identifying: 15,
      ai_consensus: 50,
      market_data: 80,
      finalizing: 95,
      complete: 100,
      error: 0,
    };

    const baseProgress = stageWeights[stage] || 0;

    // If we have model vote data, interpolate within the ai_consensus stage
    if (stage === 'ai_consensus' && scanProgress?.modelsTotal && scanProgress.modelsComplete !== undefined) {
      const aiRange = stageWeights.ai_consensus - stageWeights.identifying;
      const modelProgress = (scanProgress.modelsComplete / scanProgress.modelsTotal) * aiRange;
      return stageWeights.identifying + modelProgress;
    }

    return baseProgress;
  }, [stage, scanProgress?.modelsComplete, scanProgress?.modelsTotal]);

  // Current price estimate (animated via CSS transition)
  const currentEstimate = scanProgress?.currentEstimate || 0;
  const confidence = scanProgress?.confidence || 0;
  const detectedCategory = scanProgress?.category || null;
  const aiModels = scanProgress?.aiModels || [];

  // Reduced motion check
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Don't render if not analyzing
  if (!isAnalyzing) return null;

  const showText = oracleEngagement !== 'ambient';
  const showOracle = oracleEngagement === 'conversational';
  const isError = stage === 'error';
  const isComplete = stage === 'complete';

  return (
    <div
      className={`oracle-thinking-overlay ${reducedMotion ? 'oracle-thinking-overlay--reduced' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Analysis in progress"
    >
      {/* Background gradient layer */}
      <div className="oracle-thinking-bg" aria-hidden="true" />

      {/* Main content — centered, scrollable on small screens */}
      <div className="oracle-thinking-content">

        {/* Cymatic rings — always visible in all modes */}
        <div className="oracle-thinking-visual">
          {!reducedMotion && (
            <CymaticRings intensity={isComplete ? 0.3 : 1} stage={stage} />
          )}
          <ProgressRing progress={progressPercent} />
        </div>

        {/* Stage label — always visible */}
        <AnimatePresence mode="wait">
          <motion.p
            key={stageMessage}
            className="oracle-thinking-stage"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {stageMessage}
          </motion.p>
        </AnimatePresence>

        {/* Price estimate — visible in guided + conversational */}
        {showText && currentEstimate > 0 && (
          <div className="oracle-thinking-price">
            <span className="oracle-thinking-price-label">
              {stage === 'market_data' ? 'Market Adjusted' : stage === 'finalizing' ? 'Final Value' : 'AI Estimate'}
            </span>
            <span className="oracle-thinking-price-value" style={{ '--price-confidence': confidence } as React.CSSProperties}>
              ${currentEstimate.toFixed(2)}
            </span>
            {confidence > 0 && (
              <span className="oracle-thinking-confidence">
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>
        )}

        {/* Category badge — pops in when detected */}
        {showText && detectedCategory && (
          <motion.div
            className="oracle-thinking-category"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            🏷️ {detectedCategory.replace(/_/g, ' ')}
          </motion.div>
        )}

        {/* AI Model dots — compact view in guided + conversational */}
        {showText && aiModels.length > 0 && (
          <AIModelDots models={aiModels} />
        )}

        {/* Oracle commentary — conversational mode only */}
        {showOracle && (
          <AnimatePresence mode="wait">
            <motion.div
              key={oracleLine}
              className="oracle-thinking-speech"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              <div className="oracle-thinking-speech-bubble">
                <span className="oracle-thinking-speech-icon">🔮</span>
                <p>{oracleLine}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Fun fact — guided + conversational */}
        {showText && !isComplete && !isError && (
          <AnimatePresence mode="wait">
            <motion.div
              key={funFact}
              className="oracle-thinking-fact"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <span className="oracle-thinking-fact-icon">💡</span>
              <span className="oracle-thinking-fact-text">{funFact}</span>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Elapsed time — always visible */}
        <div className="oracle-thinking-elapsed">
          {elapsed}s elapsed
        </div>

        {/* Engagement mode toggle — bottom of screen */}
        <div className="oracle-thinking-controls">
          <EngagementToggle mode={oracleEngagement} onChange={setOracleEngagement} />
        </div>

        {/* Error state */}
        {isError && scanProgress?.error && (
          <div className="oracle-thinking-error">
            <p>{scanProgress.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OracleThinkingOverlay;
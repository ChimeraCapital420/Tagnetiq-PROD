// HydraAnalysisLoader.tsx
// Engaging loading experience that shows AI consensus building in real-time
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

// ==================== TYPES ====================

interface AIModel {
  name: string;
  icon: string;
  color: string;
  weight: number;
  status: 'waiting' | 'thinking' | 'complete' | 'error';
  estimate?: number;
  responseTime?: number;
  confidence?: number;
}

interface HydraLoaderProps {
  isActive: boolean;
  imageData?: string;
  categoryHint?: string;
  authToken: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

// ==================== CONSTANTS ====================

const AI_MODELS: AIModel[] = [
  { name: 'Perplexity', icon: '🔮', color: '#20B2AA', weight: 1.7, status: 'waiting' },
  { name: 'OpenAI', icon: '🧠', color: '#10A37F', weight: 1.5, status: 'waiting' },
  { name: 'Anthropic', icon: '🎭', color: '#D4A574', weight: 1.3, status: 'waiting' },
  { name: 'Google', icon: '🔷', color: '#4285F4', weight: 1.2, status: 'waiting' },
  { name: 'Mistral', icon: '🌀', color: '#FF7000', weight: 1.0, status: 'waiting' },
  { name: 'Groq', icon: '⚡', color: '#F55036', weight: 1.0, status: 'waiting' },
  { name: 'xAI', icon: '✖️', color: '#1DA1F2', weight: 1.1, status: 'waiting' },
];

const THINKING_MESSAGES = [
  "Examining visual details...",
  "Analyzing condition markers...",
  "Cross-referencing databases...",
  "Checking recent sales...",
  "Evaluating rarity...",
  "Calculating market value...",
  "Consulting price guides...",
  "Verifying authenticity indicators...",
];

const FUN_FACTS: Record<string, string[]> = {
  pokemon_cards: [
    "The first Pokémon cards were released in Japan in 1996",
    "A PSA 10 Base Set Charizard sold for $420,000 in 2022",
    "Centering issues can drop a card's value by 50-80%",
    "Shadowless cards are worth 2-3x more than Unlimited",
  ],
  coins: [
    "The 1933 Double Eagle sold for $18.9 million",
    "Mint marks can make a coin worth 100x more",
    "Proof coins are struck twice for mirror finish",
    "Error coins are often more valuable than perfect ones",
  ],
  vinyl_records: [
    "Original pressings can be worth 10-100x reissues",
    "Matrix numbers tell you which pressing you have",
    "Japanese pressings are known for quality",
    "Mono can be worth more than stereo for 60s releases",
  ],
  general: [
    "Condition is the biggest factor in collectible value",
    "Provenance can increase value by 50% or more",
    "The collectibles market grew 25% in 2023",
    "Authentication can double an item's value",
  ],
};

// ==================== ANIMATED PRICE COMPONENT ====================

const AnimatedPrice: React.FC<{ value: number; prefix?: string }> = ({ value, prefix = '$' }) => {
  const spring = useSpring(value, { stiffness: 100, damping: 20 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(2)}`);
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span className="price-value">
      {display}
    </motion.span>
  );
};

// ==================== MAIN COMPONENT ====================

export const HydraAnalysisLoader: React.FC<HydraLoaderProps> = ({
  isActive,
  imageData,
  categoryHint = 'general',
  authToken,
  onComplete,
  onError
}) => {
  // State
  const [models, setModels] = useState<AIModel[]>(AI_MODELS);
  const [currentEstimate, setCurrentEstimate] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [phase, setPhase] = useState<'ai' | 'market' | 'finalizing'>('ai');
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [thinkingMessage, setThinkingMessage] = useState(THINKING_MESSAGES[0]);
  const [factIndex, setFactIndex] = useState(0);
  const [votesIn, setVotesIn] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [marketApis, setMarketApis] = useState<string[]>([]);
  
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Rotate thinking messages
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setThinkingMessage(THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Rotate fun facts
  useEffect(() => {
    if (!isActive) return;
    const facts = FUN_FACTS[detectedCategory || categoryHint] || FUN_FACTS.general;
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % facts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive, detectedCategory, categoryHint]);

  // Elapsed time counter
  useEffect(() => {
    if (!isActive) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  // Stream handler
  const handleStream = useCallback(async () => {
    if (!imageData) return;

    // Reset state
    setModels(AI_MODELS.map(m => ({ ...m, status: 'waiting' })));
    setCurrentEstimate(0);
    setConfidence(0);
    setPhase('ai');
    setDetectedCategory(null);
    setVotesIn(0);
    setElapsedTime(0);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          scanType: 'image',
          data: imageData,
          category_id: categoryHint,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              processEvent(event);
            } catch (e) {
              console.warn('Parse error:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        onError(error.message);
      }
    }
  }, [imageData, categoryHint, authToken, onError]);

  // Process SSE events
  const processEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'init':
        // Stagger the "thinking" animation
        event.data.models?.forEach((name: string, i: number) => {
          setTimeout(() => {
            setModels(prev => prev.map(m => 
              m.name === name ? { ...m, status: 'thinking' } : m
            ));
          }, i * 200);
        });
        break;

      case 'ai_start':
        setModels(prev => prev.map(m =>
          m.name === event.data.model ? { ...m, status: 'thinking' } : m
        ));
        break;

      case 'ai_complete':
        setModels(prev => prev.map(m =>
          m.name === event.data.model ? {
            ...m,
            status: event.data.success ? 'complete' : 'error',
            estimate: event.data.estimate,
            responseTime: event.data.responseTime,
            confidence: event.data.confidence,
          } : m
        ));
        setVotesIn(event.data.votesIn || votesIn + 1);
        break;

      case 'price_update':
        setCurrentEstimate(event.data.currentEstimate);
        setConfidence(event.data.confidence);
        break;

      case 'category_detected':
        setDetectedCategory(event.data.category);
        break;

      case 'api_start':
        setPhase('market');
        setMarketApis(event.data.apis || []);
        break;

      case 'api_complete':
        // Could show individual API completion
        break;

      case 'complete':
        setPhase('finalizing');
        setTimeout(() => {
          onComplete(event.data);
        }, 500);
        break;

      case 'error':
        onError(event.data.message);
        break;
    }
  }, [onComplete, onError, votesIn]);

  // Start streaming when active
  useEffect(() => {
    if (isActive && imageData) {
      handleStream();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isActive, imageData, handleStream]);

  if (!isActive) return null;

  const facts = FUN_FACTS[detectedCategory || categoryHint] || FUN_FACTS.general;
  const completedModels = models.filter(m => m.status === 'complete').length;
  const progress = (completedModels / models.length) * 100;

  return (
    <div className="hydra-loader-overlay">
      <style>{styles}</style>
      
      <div className="loader-container">
        {/* Header with phase indicator */}
        <div className="loader-header">
          <div className="phase-dots">
            <span className={`dot ${phase === 'ai' ? 'active' : phase !== 'ai' ? 'done' : ''}`} />
            <span className={`dot ${phase === 'market' ? 'active' : phase === 'finalizing' ? 'done' : ''}`} />
            <span className={`dot ${phase === 'finalizing' ? 'active' : ''}`} />
          </div>
          <h2 className="loader-title">
            {phase === 'ai' && 'AI Consensus Engine'}
            {phase === 'market' && 'Market Analysis'}
            {phase === 'finalizing' && 'Finalizing...'}
          </h2>
          <motion.p 
            className="thinking-text"
            key={thinkingMessage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
          >
            {thinkingMessage}
          </motion.p>
        </div>

        {/* Price Display */}
        <motion.div 
          className="price-display"
          animate={{ 
            scale: confidence > 0.5 ? [1, 1.02, 1] : 1,
            boxShadow: confidence > 0.8 ? '0 0 60px rgba(16, 185, 129, 0.3)' : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <span className="price-label">
            {phase === 'ai' ? 'AI Estimate' : phase === 'market' ? 'Market Adjusted' : 'Final Value'}
          </span>
          <div className="price-main">
            <AnimatedPrice value={currentEstimate} />
          </div>
          <div className="price-meta">
            <span className="confidence-badge" style={{ opacity: confidence }}>
              {Math.round(confidence * 100)}% confidence
            </span>
            {detectedCategory && (
              <motion.span 
                className="category-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                🏷️ {detectedCategory.replace(/_/g, ' ')}
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* AI Models Grid */}
        <div className="models-grid">
          {models.map((model, i) => (
            <motion.div
              key={model.name}
              className={`model-card ${model.status}`}
              style={{ '--accent': model.color } as React.CSSProperties}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="model-icon">{model.icon}</span>
              <span className="model-name">{model.name}</span>
              
              {model.status === 'waiting' && (
                <span className="model-status">Queued</span>
              )}
              
              {model.status === 'thinking' && (
                <div className="thinking-indicator">
                  <span className="dot-pulse" />
                  <span className="dot-pulse" />
                  <span className="dot-pulse" />
                </div>
              )}
              
              {model.status === 'complete' && (
                <div className="model-result">
                  <span className="model-estimate">${model.estimate?.toFixed(2)}</span>
                  <span className="model-time">{model.responseTime}ms</span>
                </div>
              )}
              
              {model.status === 'error' && (
                <span className="model-error">×</span>
              )}
              
              <div className="model-weight">
                {model.weight.toFixed(1)}x weight
              </div>
            </motion.div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-header">
            <span>Consensus Progress</span>
            <span>{votesIn}/{models.length} models</span>
          </div>
          <div className="progress-track">
            <motion.div 
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <div className="elapsed-time">
            {elapsedTime.toFixed(1)}s elapsed
          </div>
        </div>

        {/* Fun Fact */}
        <AnimatePresence mode="wait">
          <motion.div
            key={factIndex}
            className="fact-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <span className="fact-icon">💡</span>
            <span className="fact-text">{facts[factIndex]}</span>
          </motion.div>
        </AnimatePresence>

        {/* Market APIs (when in market phase) */}
        {phase === 'market' && marketApis.length > 0 && (
          <motion.div 
            className="market-apis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="apis-label">Checking:</span>
            {marketApis.map(api => (
              <span key={api} className="api-badge">{api}</span>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const styles = `
  .hydra-loader-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .hydra-loader-overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 30% 20%, rgba(32, 178, 170, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 70% 80%, rgba(147, 51, 234, 0.08) 0%, transparent 40%);
    pointer-events: none;
  }

  .loader-container {
    position: relative;
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .loader-header {
    text-align: center;
  }

  .phase-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .phase-dots .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    transition: all 0.3s;
  }

  .phase-dots .dot.active {
    background: #10B981;
    box-shadow: 0 0 12px #10B981;
  }

  .phase-dots .dot.done {
    background: #4A90E2;
  }

  .loader-title {
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, #20B2AA, #9333EA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0 0 8px;
  }

  .thinking-text {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0;
    min-height: 20px;
  }

  .price-display {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 24px;
    text-align: center;
  }

  .price-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.4);
  }

  .price-main {
    margin: 8px 0;
  }

  .price-value {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 48px;
    font-weight: 700;
    color: #10B981;
    text-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
  }

  .price-meta {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .confidence-badge, .category-badge {
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.7);
  }

  .category-badge {
    background: rgba(147, 51, 234, 0.2);
    color: #A78BFA;
  }

  .models-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 10px;
  }

  .model-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 8px;
    text-align: center;
    transition: all 0.3s;
  }

  .model-card.thinking {
    border-color: var(--accent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .model-card.complete {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.05);
  }

  .model-card.error {
    border-color: rgba(239, 68, 68, 0.4);
    opacity: 0.5;
  }

  .model-icon {
    font-size: 20px;
    display: block;
    margin-bottom: 4px;
  }

  .model-name {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    display: block;
  }

  .model-status {
    font-size: 10px;
    color: rgba(255,255,255,0.4);
  }

  .thinking-indicator {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 4px;
  }

  .dot-pulse {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1s ease-in-out infinite;
  }

  .dot-pulse:nth-child(2) { animation-delay: 0.2s; }
  .dot-pulse:nth-child(3) { animation-delay: 0.4s; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }

  .model-result {
    margin-top: 4px;
  }

  .model-estimate {
    font-size: 12px;
    font-weight: 600;
    color: #10B981;
    display: block;
  }

  .model-time {
    font-size: 9px;
    color: rgba(255,255,255,0.4);
  }

  .model-weight {
    font-size: 9px;
    color: rgba(255,255,255,0.3);
    margin-top: 4px;
  }

  .model-error {
    color: #EF4444;
    font-weight: bold;
  }

  .progress-container {
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    padding: 16px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    margin-bottom: 8px;
  }

  .progress-track {
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #20B2AA, #4A90E2, #9333EA);
    border-radius: 3px;
  }

  .elapsed-time {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    text-align: right;
    margin-top: 6px;
  }

  .fact-card {
    background: rgba(147, 51, 234, 0.1);
    border: 1px solid rgba(147, 51, 234, 0.2);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .fact-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .fact-text {
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    line-height: 1.4;
  }

  .market-apis {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .apis-label {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }

  .api-badge {
    font-size: 11px;
    padding: 4px 10px;
    background: rgba(74, 144, 226, 0.2);
    color: #4A90E2;
    border-radius: 8px;
    animation: apiPulse 2s ease-in-out infinite;
  }

  @keyframes apiPulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
`;

export default HydraAnalysisLoader;
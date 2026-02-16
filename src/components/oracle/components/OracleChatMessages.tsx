// FILE: src/components/oracle/components/OracleChatMessages.tsx
// Message list with rich response cards, play buttons, speaking indicators
// Renders: text bubbles, vision results, hunt verdicts, listing previews,
//          learning steps, image previews, video embeds

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play, VolumeX, Eye, ShoppingCart, AlertTriangle,
  Clock, Sparkles, Copy, RefreshCw, ExternalLink,
  CheckCircle2, XCircle, Pause, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageContent } from '../utils';
import type {
  ChatMessage, QuickChip, VisionResponse, HuntResult,
  GeneratedListing, LearningStep, RichAttachment,
} from '../types';

// =============================================================================
// WAVEFORM — shows during active speech playback
// =============================================================================

function SpeakingWaveform() {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="w-[3px] bg-cyan-400 rounded-full"
          animate={{ height: ['8px', '16px', '8px'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// HUNT VERDICT BADGE
// =============================================================================

function HuntVerdictCard({ data }: { data: HuntResult }) {
  const verdictColors: Record<string, string> = {
    BUY: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
    SKIP: 'bg-red-500/20 border-red-500/50 text-red-400',
    HOLD: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    RESEARCH: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  };

  const verdictIcons: Record<string, React.ReactNode> = {
    BUY: <ShoppingCart className="w-4 h-4" />,
    SKIP: <XCircle className="w-4 h-4" />,
    HOLD: <Pause className="w-4 h-4" />,
    RESEARCH: <Eye className="w-4 h-4" />,
  };

  return (
    <div className={cn(
      'mt-2 rounded-xl border p-3 text-sm',
      verdictColors[data.verdict] || verdictColors.HOLD,
    )}>
      <div className="flex items-center gap-2 mb-2">
        {verdictIcons[data.verdict]}
        <span className="font-bold text-base">{data.verdict}</span>
        <span className="text-xs opacity-70 ml-auto">{data.confidence}% confident</span>
      </div>

      <p className="font-medium mb-1">{data.itemName}</p>
      <p className="text-xs opacity-80 mb-2">{data.reasoning}</p>

      <div className="flex gap-3 text-xs">
        <span>Est: ${data.estimatedValue.low}–${data.estimatedValue.high}</span>
        {data.askingPrice != null && <span>Ask: ${data.askingPrice}</span>}
        {data.margin && (
          <span className={data.margin.amount > 0 ? 'text-emerald-400' : 'text-red-400'}>
            Margin: {data.margin.amount > 0 ? '+' : ''}${data.margin.amount} ({data.margin.percentage}%)
          </span>
        )}
      </div>

      {data.quickFacts && data.quickFacts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.quickFacts.map((fact, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">{fact}</span>
          ))}
        </div>
      )}

      <div className="mt-2 text-[10px] opacity-50 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {data.processingTimeMs}ms
      </div>
    </div>
  );
}

// =============================================================================
// VISION RESULT CARD
// =============================================================================

function VisionResultCard({ data }: { data: VisionResponse }) {
  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-4 h-4 text-primary" />
        <span className="font-medium capitalize">{data.mode.replace('_', ' ')}</span>
        <span className="text-[10px] opacity-50 ml-auto">{data.processingTimeMs}ms</span>
      </div>

      {data.objects.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {data.objects.slice(0, 5).map((obj, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-medium">{obj.name}</span>
              <div className="flex items-center gap-2">
                {obj.estimatedValue && (
                  <span className="text-emerald-400">
                    ${obj.estimatedValue.low}–${obj.estimatedValue.high}
                  </span>
                )}
                <span className="text-[10px] opacity-50">{Math.round(obj.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.extractedText && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            📝 Extracted text
          </summary>
          <p className="mt-1 text-xs p-2 bg-black/20 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto">
            {data.extractedText}
          </p>
        </details>
      )}
    </div>
  );
}

// =============================================================================
// LISTING PREVIEW CARD
// =============================================================================

function ListingPreviewCard({
  data,
  onCopy,
  onRegenerate,
}: {
  data: GeneratedListing;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) {
  const handleCopy = () => {
    const text = `${data.title}\n\n${data.description}\n\nPrice: $${data.suggestedPrice}\nTags: ${data.tags.join(', ')}`;
    navigator.clipboard.writeText(text).catch(() => {});
    onCopy?.();
  };

  return (
    <div className="mt-2 rounded-xl border border-border/50 bg-accent/20 p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="font-medium">Generated Listing</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/50 ml-auto capitalize">
          {data.platform}
        </span>
      </div>

      <h4 className="font-semibold text-foreground mb-1">{data.title}</h4>
      <p className="text-xs text-muted-foreground mb-2 line-clamp-4">{data.description}</p>

      <div className="flex items-center gap-3 text-xs mb-2">
        <span className="font-medium text-emerald-400">${data.suggestedPrice}</span>
        {data.condition && <span className="opacity-70">Condition: {data.condition}</span>}
        {data.voiceMatched && (
          <span className="flex items-center gap-1 text-primary">
            <CheckCircle2 className="w-3 h-3" /> Your voice
          </span>
        )}
      </div>

      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {data.tags.map((tag, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/40">#{tag}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-accent/40 hover:bg-accent/70 transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-accent/40 hover:bg-accent/70 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LEARNING STEP CARD
// =============================================================================

function LearningStepCard({ data }: { data: LearningStep }) {
  return (
    <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-blue-400" />
        <span className="font-medium">{data.title}</span>
        <span className="text-[10px] opacity-50 ml-auto">
          Step {data.stepNumber}/{data.totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-blue-500/10 rounded-full mb-3">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${(data.stepNumber / data.totalSteps) * 100}%` }}
        />
      </div>

      <div className="text-xs whitespace-pre-wrap">{data.content}</div>

      {data.challenge && (
        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-medium text-amber-400 mb-1">💡 Challenge</p>
          <p className="text-xs">{data.challenge}</p>
          {data.hint && (
            <details className="mt-1">
              <summary className="text-[10px] text-muted-foreground cursor-pointer">Show hint</summary>
              <p className="text-[10px] mt-1 text-muted-foreground">{data.hint}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RICH ATTACHMENT RENDERER
// =============================================================================

function RichAttachmentCard({ attachment }: { attachment: RichAttachment }) {
  switch (attachment.type) {
    case 'vision':
      return <VisionResultCard data={attachment.data} />;
    case 'hunt':
      return <HuntVerdictCard data={attachment.data} />;
    case 'listing':
      return <ListingPreviewCard data={attachment.data} />;
    case 'learning':
      return <LearningStepCard data={attachment.step} />;
    case 'image':
      return (
        <div className="mt-2">
          <img
            src={attachment.url}
            alt={attachment.alt || 'Generated image'}
            className="rounded-xl max-w-full max-h-64 object-contain"
          />
        </div>
      );
    case 'video':
      return (
        <div className="mt-2 rounded-xl border border-border/50 bg-accent/20 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-medium">Video {attachment.status === 'ready' ? 'Ready' : 'Generating...'}</span>
          </div>
          {attachment.url && attachment.status === 'ready' && (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Open video
            </a>
          )}
        </div>
      );
    default:
      return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  quickChips: QuickChip[];
  playingIdx: number | null;
  isSpeaking: boolean;
  onPlay: (msg: ChatMessage, idx: number) => void;
  onChipClick: (message: string) => void;
}

export function OracleChatMessages({
  messages, isLoading, quickChips, playingIdx, isSpeaking,
  onPlay, onChipClick,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            key={`${msg.timestamp}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className={cn(
              'max-w-[85%] group',
              msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'
            )}>
              {/* Image preview for user-sent images */}
              {msg.role === 'user' && msg.imagePreview && (
                <div className="mb-1.5">
                  <img
                    src={msg.imagePreview.startsWith('data:')
                      ? msg.imagePreview
                      : `data:image/jpeg;base64,${msg.imagePreview}`}
                    alt="Sent image"
                    className="w-32 h-32 rounded-xl object-cover border border-border/30"
                  />
                  {msg.visionMode && (
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5 block capitalize">
                      {msg.visionMode.replace('_', ' ')} mode
                    </span>
                  )}
                </div>
              )}

              {/* Text bubble */}
              <div className={cn(
                'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-accent/60 text-foreground rounded-bl-md'
              )}>
                {/* Waveform overlay when playing this message */}
                {msg.role === 'assistant' && playingIdx === i && isSpeaking && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <SpeakingWaveform />
                    <span className="text-[10px] text-cyan-400">Speaking</span>
                  </div>
                )}
                {formatMessageContent(msg.content)}
              </div>

              {/* Rich attachments */}
              {msg.attachments && msg.attachments.map((attachment, ai) => (
                <RichAttachmentCard key={ai} attachment={attachment} />
              ))}

              {/* Legacy support: direct vision/hunt data on message */}
              {msg.visionData && !msg.attachments?.some(a => a.type === 'vision') && (
                <VisionResultCard data={msg.visionData} />
              )}
              {msg.huntData && !msg.attachments?.some(a => a.type === 'hunt') && (
                <HuntVerdictCard data={msg.huntData} />
              )}

              {/* Play / Stop button on assistant messages */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => onPlay(msg, i)}
                  className={cn(
                    'mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-all',
                    playingIdx === i && isSpeaking
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/40',
                    playingIdx === i && isSpeaking ? '' : 'sm:opacity-0 sm:group-hover:opacity-100'
                  )}
                >
                  {playingIdx === i && isSpeaking ? (
                    <><VolumeX className="w-3 h-3" /><span>Stop</span></>
                  ) : (
                    <><Play className="w-3 h-3" /><span>Listen</span></>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Quick chips — only shown early in conversation */}
      {quickChips.length > 0 && messages.length <= 2 && (
        <div className="flex-none px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {quickChips.map((chip, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onChipClick(chip.message)}
                disabled={isLoading}
                className="flex-none text-xs px-3 py-1.5 rounded-full border border-border/50 bg-accent/30 hover:bg-accent/60 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

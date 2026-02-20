// FILE: src/features/boardroom/components/PersonalityBadge.tsx
// Personality evolution badge — shows evolved traits
//
// Sprint 7: Displays the personality evolution data from Sprint 4.
// Compact mode: just generation count + voice signature snippet
// Expanded mode: catchphrases, expertise evolution, communication style
//
// Used in member cards and member profile views.

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronDown, ChevronUp, Quote, Brain, MessageCircle } from 'lucide-react';
import type { PersonalityEvolution } from '../types';

interface PersonalityBadgeProps {
  evolution: PersonalityEvolution | null | undefined;
  /** Member name for display */
  memberName?: string;
  /** Compact = inline badge, expanded = full card */
  variant?: 'compact' | 'expanded';
  className?: string;
}

export const PersonalityBadge: React.FC<PersonalityBadgeProps> = ({
  evolution,
  memberName,
  variant = 'compact',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!evolution) {
    return (
      <span className={cn('text-[10px] text-muted-foreground/50 italic', className)}>
        Not yet evolved
      </span>
    );
  }

  const gen = evolution.generation || 1;

  if (variant === 'compact') {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
          'bg-purple-500/10 text-purple-400 text-[10px] font-medium',
          'hover:bg-purple-500/20 transition-colors',
          className,
        )}
      >
        <Sparkles className="w-2.5 h-2.5" />
        Gen {gen}
        {evolution.catchphrases && evolution.catchphrases.length > 0 && (
          <span className="text-purple-400/60 ml-0.5">
            · {evolution.catchphrases.length} phrases
          </span>
        )}
      </button>
    );
  }

  // Expanded variant — full personality card
  return (
    <div className={cn('rounded-lg bg-muted p-3 space-y-3', className)}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold">
            Personality · Gen {gen}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 pt-1">
          {/* Voice Signature */}
          {evolution.voice_signature && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> Voice Signature
              </p>
              <p className="text-xs text-foreground/80">
                {evolution.voice_signature}
              </p>
            </div>
          )}

          {/* Catchphrases */}
          {evolution.catchphrases && evolution.catchphrases.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Quote className="w-3 h-3" /> Catchphrases
              </p>
              <div className="flex flex-wrap gap-1.5">
                {evolution.catchphrases.map((phrase, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[11px]"
                  >
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Expertise Evolution */}
          {evolution.expertise_evolution && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Brain className="w-3 h-3" /> Expertise Growth
              </p>
              <p className="text-xs text-foreground/80">
                {evolution.expertise_evolution}
              </p>
            </div>
          )}

          {/* Communication Style */}
          {evolution.communication_style && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Communication Style
              </p>
              <p className="text-xs text-foreground/80">
                {evolution.communication_style}
              </p>
            </div>
          )}

          {/* Cross-member Opinions */}
          {evolution.cross_member_opinions && Object.keys(evolution.cross_member_opinions).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Views on Colleagues
              </p>
              <div className="space-y-1">
                {Object.entries(evolution.cross_member_opinions).map(([slug, opinion]) => (
                  <p key={slug} className="text-xs text-foreground/70">
                    <span className="font-medium text-foreground/90">{slug}:</span> {opinion}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Inside References */}
          {evolution.inside_references && evolution.inside_references.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Shared Memories
              </p>
              <ul className="space-y-0.5">
                {evolution.inside_references.map((ref, i) => (
                  <li key={i} className="text-xs text-foreground/70">• {ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PersonalityBadge;
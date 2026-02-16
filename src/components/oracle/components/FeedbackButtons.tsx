// FILE: src/components/oracle/components/FeedbackButtons.tsx
// Thumbs up/down buttons for Oracle responses
// Drop into any message bubble — lightweight, mobile-optimized tap targets

import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackButtonsProps {
  messageIndex: number;
  currentRating: 'up' | 'down' | null;
  onRate: (index: number, rating: 'up' | 'down') => void;
  disabled?: boolean;
  className?: string;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  messageIndex,
  currentRating,
  onRate,
  disabled = false,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1 mt-1', className)}>
      <button
        type="button"
        onClick={() => onRate(messageIndex, 'up')}
        disabled={disabled}
        className={cn(
          'p-1.5 rounded-full transition-all touch-manipulation',
          'hover:bg-green-500/10 active:scale-90',
          currentRating === 'up'
            ? 'text-green-500 bg-green-500/10'
            : 'text-muted-foreground/40 hover:text-green-500',
        )}
        aria-label="Helpful"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onRate(messageIndex, 'down')}
        disabled={disabled}
        className={cn(
          'p-1.5 rounded-full transition-all touch-manipulation',
          'hover:bg-red-500/10 active:scale-90',
          currentRating === 'down'
            ? 'text-red-500 bg-red-500/10'
            : 'text-muted-foreground/40 hover:text-red-500',
        )}
        aria-label="Not helpful"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default FeedbackButtons;

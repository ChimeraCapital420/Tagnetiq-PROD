// FILE: src/components/analysis/components/FeedbackStars.tsx
// Star rating for analysis accuracy feedback.

import React from 'react';
import { Star } from 'lucide-react';

interface FeedbackStarsProps {
  hoveredRating: number;
  givenRating: number;
  feedbackSubmitted: boolean;
  onHover: (star: number) => void;
  onLeave: () => void;
  onRate: (star: number) => void;
}

const FeedbackStars: React.FC<FeedbackStarsProps> = ({
  hoveredRating,
  givenRating,
  feedbackSubmitted,
  onHover,
  onLeave,
  onRate,
}) => {
  return (
    <div className="w-full text-center">
      <p className="text-xs text-muted-foreground mb-2">
        {feedbackSubmitted ? 'Thank you for your feedback!' : 'Rate Analysis Accuracy'}
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
            onMouseEnter={() => !feedbackSubmitted && onHover(star)}
            onMouseLeave={onLeave}
            onClick={() => onRate(star)}
          />
        ))}
      </div>
    </div>
  );
};

export default FeedbackStars;
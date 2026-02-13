// FILE: src/components/oracle/SharePromptBanner.tsx
// Share Prompt Banner — Oracle's gentle nudge to share
//
// Sprint E: Not a modal. Not a popup. A subtle banner that slides in
// from the bottom with Oracle's voice, suggesting the user share.
//
// Mobile-first: bottom-anchored, swipe-to-dismiss friendly, 44px touch targets.
// Auto-dismisses after 15 seconds if user doesn't interact.

import React, { useEffect, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SharePromptBannerProps {
  message: string;
  onShare: () => Promise<boolean | undefined>;
  onDismiss: () => void;
}

const SharePromptBanner: React.FC<SharePromptBannerProps> = ({
  message,
  onShare,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Slide in after a short delay (feels more natural)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleShare = async () => {
    const result = await onShare();
    if (result !== false) {
      toast.success('Link copied! Share it anywhere.');
    }
    setExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-50 max-w-lg mx-auto",
        "transition-all duration-300 ease-out",
        visible && !exiting
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      )}
    >
      <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* Oracle avatar indicator */}
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Share2 className="h-4 w-4 text-cyan-400" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 leading-relaxed">
              {message}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                onClick={handleShare}
                size="sm"
                className="h-9 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg touch-manipulation"
                data-tour="share-button"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Share
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-gray-400 hover:text-gray-200 text-xs touch-manipulation"
              >
                Maybe later
              </Button>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="text-gray-600 hover:text-gray-400 transition-colors touch-manipulation p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePromptBanner;
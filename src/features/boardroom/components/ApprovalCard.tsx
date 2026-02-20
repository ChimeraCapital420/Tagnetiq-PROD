// FILE: src/features/boardroom/components/ApprovalCard.tsx
// Approval Card — Mobile-first action approval interface
//
// Sprint 7: Compact card showing a pending action with approve/reject.
// On mobile: tap buttons (swipe gestures could be added later).
// Shows impact level badge, trust at creation, cost if any.

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Check,
  X,
  AlertTriangle,
  DollarSign,
  Users,
  RotateCcw,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPACT_COLORS, TRUST_TIER_CONFIG, getTrustTierLabel } from '../constants';
import type { PendingAction } from '../types';

interface ApprovalCardProps {
  action: PendingAction;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
  className?: string;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  action,
  onApprove,
  onReject,
  className,
}) => {
  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const trustTier = getTrustTierLabel(action.trust);
  const tierConfig = TRUST_TIER_CONFIG[trustTier];
  const impactColor = IMPACT_COLORS[action.impact] || IMPACT_COLORS.low;

  const handleApprove = async () => {
    setProcessing('approve');
    await onApprove(action.id);
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setProcessing('reject');
    await onReject(action.id, rejectReason.trim());
    setProcessing(null);
    setShowRejectInput(false);
    setRejectReason('');
  };

  const timeAgo = formatTimeAgo(action.createdAt);

  return (
    <div className={cn('rounded-lg bg-muted p-3 space-y-2', className)}>
      {/* Header row: member + impact badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{action.memberName}</span>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', impactColor)}>
          {action.impact}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <p className="text-sm font-semibold">{action.title}</p>
        {action.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {action.description}
          </p>
        )}
      </div>

      {/* Meta row: trust, cost, flags */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className={cn('font-medium', tierConfig.color)}>
          Trust: {action.trust} ({tierConfig.label})
        </span>
        {action.cost != null && action.cost > 0 && (
          <span className="flex items-center gap-0.5 text-amber-400">
            <DollarSign className="w-3 h-3" />${action.cost}
          </span>
        )}
        {action.affectsUsers && (
          <span className="flex items-center gap-0.5 text-orange-400">
            <Users className="w-3 h-3" />Affects users
          </span>
        )}
        {action.reversible && (
          <span className="flex items-center gap-0.5 text-blue-400">
            <RotateCcw className="w-3 h-3" />Reversible
          </span>
        )}
        <span className="text-muted-foreground/60">{timeAgo}</span>
      </div>

      {/* Action buttons */}
      {!showRejectInput ? (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={processing !== null}
            className="flex-1 h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
          >
            {processing === 'approve' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectInput(true)}
            disabled={processing !== null}
            className="flex-1 h-8 gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full h-8 px-3 text-xs rounded-md bg-background border border-input focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleReject()}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing !== null}
              className="flex-1 h-7 text-xs"
            >
              {processing === 'reject' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Confirm Reject'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
              disabled={processing !== null}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default ApprovalCard;
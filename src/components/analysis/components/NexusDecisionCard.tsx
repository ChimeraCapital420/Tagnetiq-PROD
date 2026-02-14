// FILE: src/components/analysis/components/NexusDecisionCard.tsx
// Sprint M: Oracle-guided post-scan suggestion.
// Renders the Nexus decision with conversational message, market demand,
// listing draft preview, and action buttons.

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Eye, Shield, Package, Ghost, Camera } from 'lucide-react';
import type { NexusData, NexusAction } from '../types.js';

// Icon map for action buttons
const NEXUS_ICONS: Record<string, React.ReactNode> = {
  'zap': <Zap className="h-4 w-4" />,
  'eye': <Eye className="h-4 w-4" />,
  'shield': <Shield className="h-4 w-4" />,
  'package': <Package className="h-4 w-4" />,
  'ghost': <Ghost className="h-4 w-4" />,
  'camera': <Camera className="h-4 w-4" />,
  'gem': <Zap className="h-4 w-4" />,
  'lock': <Shield className="h-4 w-4" />,
};

interface NexusDecisionCardProps {
  nexus: NexusData;
  analysisId: string;
  onList: () => void;
  onVault: () => void;
  onWatch: () => void;
  onDismiss: () => void;
  onScanMore: () => void;
}

const NexusDecisionCard: React.FC<NexusDecisionCardProps> = ({
  nexus, analysisId, onList, onVault, onWatch, onDismiss, onScanMore,
}) => {
  const { user } = useAuth();
  const [actionTaken, setActionTaken] = useState(false);

  const logAction = async (action: string) => {
    if (!user || actionTaken) return;
    setActionTaken(true);
    try {
      await fetch('/api/oracle/nexus-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, action, nudgeType: nexus.nudge }),
      });
    } catch {
      // Non-critical
    }
  };

  const handleAction = (action: NexusAction) => {
    logAction(action.type);
    switch (action.type) {
      case 'list':
      case 'ghost_list': onList(); break;
      case 'vault':      onVault(); break;
      case 'watch':      onWatch(); break;
      case 'scan_more':  onScanMore(); break;
      case 'dismiss':
      default:           onDismiss(); break;
    }
  };

  const demandColor = nexus.marketDemand === 'hot'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : nexus.marketDemand === 'warm'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : nexus.marketDemand === 'cold'
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div className="w-full p-4 border rounded-lg bg-gradient-to-br from-background to-muted/30 space-y-3">
      {/* Oracle's message */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {nexus.message}
          </p>
          {nexus.followUp && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {nexus.followUp}
            </p>
          )}
        </div>
        {nexus.marketDemand !== 'unknown' && (
          <Badge variant="outline" className={`flex-shrink-0 text-xs ${demandColor}`}>
            {nexus.marketDemand === 'hot' ? '🔥' : nexus.marketDemand === 'warm' ? '🌡️' : '❄️'} {nexus.marketDemand}
          </Badge>
        )}
      </div>

      {/* Listing draft preview */}
      {nexus.listingDraft && (
        <div className="pl-11 space-y-1">
          <p className="text-xs text-muted-foreground">
            Suggested price: <span className="font-medium text-foreground">
              ${nexus.listingDraft.suggestedPrice?.toFixed(0)}
            </span>
            <span className="text-muted-foreground/60">
              {' '}(range: ${nexus.listingDraft.priceRange?.low?.toFixed(0)} – ${nexus.listingDraft.priceRange?.high?.toFixed(0)})
            </span>
          </p>
          {nexus.listingDraft.suggestions && nexus.listingDraft.suggestions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              💡 {nexus.listingDraft.suggestions[0]}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pl-11">
        {nexus.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.primary ? 'default' : 'outline'}
            size="sm"
            className={action.primary ? 'font-medium' : ''}
            onClick={() => handleAction(action)}
            disabled={actionTaken}
          >
            {action.icon && NEXUS_ICONS[action.icon] && (
              <span className="mr-1.5">{NEXUS_ICONS[action.icon]}</span>
            )}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default NexusDecisionCard;
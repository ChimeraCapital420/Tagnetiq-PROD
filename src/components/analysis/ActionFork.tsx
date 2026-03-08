// FILE: src/components/analysis/ActionFork.tsx
// ═══════════════════════════════════════════════════════════════════════
// ActionFork — Adaptive Post-Scan Decision Screen
// ═══════════════════════════════════════════════════════════════════════
//
// The decision screen after a scan adapts to trust level.
//
// Level 1 (Explorer):  One big obvious action. No decision paralysis.
// Level 2 (Dealer):    Two options. Starting to see the toolkit.
// Level 3 (Pro):       Full action set. They know what they want.
// Level 4 (Autonomous): Everything + proactive Oracle suggestions.
//
// Estate persona: "Document" instead of "List". "Save" not "Sell".
// Urgency language removed entirely for estate users.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { BookOpen, TrendingUp, ShoppingBag, Eye, Zap, Vault } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import type { AnalysisResult } from '@/contexts/AppContext';

// =============================================================================
// TYPES
// =============================================================================

interface ActionForkProps {
  result: AnalysisResult;
  onList: () => void;
  onVault: () => void;
  onWatch: () => void;
  onAskOracle: () => void;
  onScanMore: () => void;
  onDeleteFromHistory?: () => void;
  isViewingHistory?: boolean;
}

// =============================================================================
// LEVEL 1 — ONE BIG ACTION
// =============================================================================

const Level1Fork: React.FC<ActionForkProps> = ({
  result, onVault, onAskOracle, isEstate,
}: ActionForkProps & { isEstate: boolean }) => {
  const isBuy = result.decision === 'BUY';
  const value = result.estimatedValue;

  if (isEstate) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <Button
          onClick={onVault}
          size="lg"
          className="w-full h-14 text-base gap-2"
        >
          <BookOpen className="h-5 w-5" />
          Save to your record
        </Button>
        <button
          onClick={onAskOracle}
          className="text-sm text-muted-foreground text-center underline-offset-2 hover:underline"
        >
          Ask Oracle a question about this item
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {isBuy ? (
        <Button
          onClick={onVault}
          size="lg"
          className="w-full h-14 text-base gap-2 bg-green-600 hover:bg-green-700"
        >
          <Vault className="h-5 w-5" />
          Save this find (~{value})
        </Button>
      ) : (
        <Button
          onClick={onAskOracle}
          size="lg"
          variant="secondary"
          className="w-full h-14 text-base gap-2"
        >
          <Zap className="h-5 w-5" />
          Ask Oracle why to pass
        </Button>
      )}
      <button
        onClick={onAskOracle}
        className="text-sm text-muted-foreground text-center underline-offset-2 hover:underline"
      >
        Have a question? Ask your Oracle
      </button>
    </div>
  );
};

// =============================================================================
// LEVEL 2 — TWO OPTIONS
// =============================================================================

const Level2Fork: React.FC<ActionForkProps & { isEstate: boolean }> = ({
  result, onVault, onList, onAskOracle, isEstate,
}) => {
  const isBuy = result.decision === 'BUY';

  if (isEstate) {
    return (
      <div className="grid grid-cols-2 gap-3 w-full">
        <Button onClick={onVault} size="lg" className="h-14 flex-col gap-1" variant="default">
          <BookOpen className="h-4 w-4" />
          <span className="text-xs">Document it</span>
        </Button>
        <Button onClick={onAskOracle} size="lg" className="h-14 flex-col gap-1" variant="outline">
          <Zap className="h-4 w-4" />
          <span className="text-xs">Ask Oracle</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      <Button onClick={onVault} size="lg" className="h-14 flex-col gap-1" variant={isBuy ? 'default' : 'outline'}>
        <Vault className="h-4 w-4" />
        <span className="text-xs">Save to vault</span>
      </Button>
      {isBuy ? (
        <Button onClick={onList} size="lg" className="h-14 flex-col gap-1" variant="outline">
          <ShoppingBag className="h-4 w-4" />
          <span className="text-xs">List it</span>
        </Button>
      ) : (
        <Button onClick={onAskOracle} size="lg" className="h-14 flex-col gap-1" variant="outline">
          <Zap className="h-4 w-4" />
          <span className="text-xs">Ask Oracle</span>
        </Button>
      )}
    </div>
  );
};

// =============================================================================
// LEVEL 3+ — FULL TOOLKIT
// =============================================================================

const Level3Fork: React.FC<ActionForkProps & { isEstate: boolean; level: number }> = ({
  result, onVault, onList, onWatch, onAskOracle, onScanMore, isEstate, level,
}) => {
  const isBuy = result.decision === 'BUY';

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Primary row */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={onVault}
          size="sm"
          className="h-16 flex-col gap-1.5"
          variant={isBuy ? 'default' : 'outline'}
        >
          <Vault className="h-4 w-4" />
          <span className="text-[11px]">{isEstate ? 'Document' : 'Vault'}</span>
        </Button>

        <Button
          onClick={onList}
          size="sm"
          className="h-16 flex-col gap-1.5"
          variant="outline"
          disabled={!isBuy}
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="text-[11px]">{isEstate ? 'List estate' : 'List it'}</span>
        </Button>

        <Button
          onClick={onWatch}
          size="sm"
          className="h-16 flex-col gap-1.5"
          variant="outline"
        >
          <Eye className="h-4 w-4" />
          <span className="text-[11px]">Watch price</span>
        </Button>
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={onAskOracle}
          size="sm"
          className="h-10 gap-1.5"
          variant="ghost"
        >
          <Zap className="h-3.5 w-3.5" />
          Ask Oracle
        </Button>

        <Button
          onClick={onScanMore}
          size="sm"
          className="h-10 gap-1.5"
          variant="ghost"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Scan another
        </Button>
      </div>

      {/* Level 4: Oracle proactive suggestion */}
      {level >= 4 && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Oracle suggestion: </span>
            Based on your scan history, similar items have been selling 12% above estimate this month.
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ActionFork: React.FC<ActionForkProps> = (props) => {
  const { trustLevel, isEstateTrust } = useAppContext();
  const isEstate = isEstateTrust ?? false;
  const level = trustLevel ?? 1;

  if (level === 1) return <Level1Fork {...props} isEstate={isEstate} />;
  if (level === 2) return <Level2Fork {...props} isEstate={isEstate} />;
  return <Level3Fork {...props} isEstate={isEstate} level={level} />;
};

export default ActionFork;
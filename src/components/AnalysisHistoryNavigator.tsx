// FILE: src/components/AnalysisHistoryNavigator.tsx

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AnalysisHistoryNavigator: React.FC = () => {
  const {
    analysisHistory,
    currentAnalysisIndex,
    navigateHistory,
    returnToLiveAnalysis,
    isLoadingHistory,
    totalHistoryCount
  } = useAppContext();

  if (analysisHistory.length === 0 && !isLoadingHistory) return null;

  const isViewingHistory = currentAnalysisIndex !== null;
  const canGoPrev = isViewingHistory ? currentAnalysisIndex > 0 : analysisHistory.length > 0;
  const canGoNext = isViewingHistory ? currentAnalysisIndex < analysisHistory.length - 1 : false;

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
      {isViewingHistory && (
        <>
          <Badge variant="outline" className="text-xs">
            <History className="h-3 w-3 mr-1" />
            History {currentAnalysisIndex + 1}/{analysisHistory.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={returnToLiveAnalysis}
            title="Return to current analysis"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigateHistory('prev')}
          disabled={!canGoPrev || isLoadingHistory}
          title="Previous analysis"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="text-xs text-muted-foreground px-2 select-none">
          {totalHistoryCount > 0 ? `${totalHistoryCount} saved` : 'Loading...'}
        </span>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigateHistory('next')}
          disabled={!canGoNext || isLoadingHistory}
          title="Next analysis"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
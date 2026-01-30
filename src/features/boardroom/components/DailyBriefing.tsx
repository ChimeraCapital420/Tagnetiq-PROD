// FILE: src/features/boardroom/components/DailyBriefing.tsx
// Daily briefing section component

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sun, Loader2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { VoiceButton } from './VoiceButton';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type { Briefing } from '../types';
import { LOADING_MESSAGES } from '../constants';

interface DailyBriefingProps {
  briefing: Briefing | null;
  isLoading: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onGenerateBriefing: () => void;
}

const DailyBriefingContent: React.FC<DailyBriefingProps> = ({
  briefing,
  isLoading,
  expanded,
  onExpandedChange,
  onGenerateBriefing,
}) => {
  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sun className="h-5 w-5 text-yellow-500" />
                <div>
                  <CardTitle className="text-lg">Daily Briefing</CardTitle>
                  <CardDescription>
                    {briefing 
                      ? `Generated ${new Date(briefing.created_at).toLocaleTimeString()}`
                      : 'Your board is ready to brief you'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!briefing && (
                  <Button 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); onGenerateBriefing(); }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Generate Briefing
                  </Button>
                )}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  {LOADING_MESSAGES.briefing}
                </p>
              </div>
            ) : briefing ? (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                        Executive Summary
                      </h4>
                      <p className="text-amber-800 dark:text-amber-200 text-sm">
                        {briefing.summary || 'No summary available.'}
                      </p>
                    </div>
                    <VoiceButton 
                      text={briefing.summary || 'No summary'} 
                      memberSlug="griffin" 
                      memberName="Griffin" 
                    />
                  </div>
                </div>

                {/* Sections */}
                {(briefing.sections || []).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(briefing.sections || []).map((section, idx) => (
                      <Card key={`section-${idx}-${section.member_slug}`} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium text-sm truncate">{section.title}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {section.member_name}
                            </Badge>
                          </div>
                          <VoiceButton 
                            text={section.content} 
                            memberSlug={section.member_slug} 
                            memberName={section.member_name} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-4">
                          {section.content}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onGenerateBriefing}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Briefing
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Sun className="h-12 w-12 text-yellow-500/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No briefing yet today. Click above to have your board prepare one.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Wrap with error boundary
export const DailyBriefing: React.FC<DailyBriefingProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Briefing Unavailable"
    fallbackMessage="The daily briefing section encountered an error. Other boardroom features should still work."
  >
    <DailyBriefingContent {...props} />
  </BoardroomErrorBoundary>
);

export default DailyBriefing;
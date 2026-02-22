// FILE: src/features/boardroom/components/TaskDashboard/QuickTaskSection.tsx
// ═══════════════════════════════════════════════════════════════════════
// QUICK TASKS — Preset one-click tasks with inline results
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2, CheckCircle2, ChevronDown, ChevronUp,
  Sparkles, FileText,
} from 'lucide-react';
import { CopyButton } from './constants';
import { QUICK_TASKS } from '../../constants';
import type { BoardMember, QuickTask, TaskResult } from './types';

interface QuickTaskSectionProps {
  taskResults: TaskResult[];
  loadingTaskId: string | null;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
  onExecute: (task: QuickTask) => Promise<void>;
  onClearResults: () => void;
}

export const QuickTaskSection: React.FC<QuickTaskSectionProps> = ({
  taskResults,
  loadingTaskId,
  getMemberBySlug,
  onExecute,
  onClearResults,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
          <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
          Quick Tasks
          {taskResults.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{taskResults.length} done</Badge>
          )}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-3">
              One-click preset tasks. Results appear inline.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_TASKS.map((task) => {
                const member = getMemberBySlug(task.assignedTo);
                const isLoading = loadingTaskId === task.id;
                const completed = taskResults.some(r => r.id === task.id);

                return (
                  <Button
                    key={task.id}
                    variant={completed ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={isLoading}
                    onClick={() => onExecute(task)}
                    className="h-auto py-1.5 px-2.5 text-xs gap-1.5"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : completed ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    {task.label}
                    <Badge variant="outline" className="text-[9px] ml-0.5">
                      {member?.name?.split(' ')[0] || task.assignedTo}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {/* Inline results */}
            {taskResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium">Results</h4>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={onClearResults}>
                    Clear
                  </Button>
                </div>
                {taskResults.map((result, idx) => (
                  <div key={`qr-${idx}-${result.id}`} className="p-2 rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px]">{result.member}</Badge>
                      <CopyButton content={result.content} />
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap font-sans">
                      {result.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
// FILE: src/features/boardroom/components/QuickTasks.tsx
// Quick tasks section component

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Briefcase, Loader2, FileText, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import { toast } from 'sonner';
import type { BoardMember, QuickTask, TaskResult } from '../types';
import { QUICK_TASKS, SUCCESS_MESSAGES } from '../constants';

interface QuickTasksProps {
  members: BoardMember[];
  taskResults: TaskResult[];
  loadingTaskId: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onExecuteTask: (task: QuickTask) => void;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

const CopyButton: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(SUCCESS_MESSAGES.messageCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
};

const QuickTasksContent: React.FC<QuickTasksProps> = ({
  taskResults,
  loadingTaskId,
  expanded,
  onExpandedChange,
  onExecuteTask,
  getMemberBySlug,
}) => {
  const hasResult = (taskId: string) => taskResults.some(r => r.id === taskId);

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-blue-500" />
                <div>
                  <CardTitle className="text-lg">Quick Tasks</CardTitle>
                  <CardDescription>Assign work to board members with one click</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {taskResults.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {taskResults.length} completed
                  </Badge>
                )}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {/* Task Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_TASKS.map((task) => {
                const member = getMemberBySlug(task.assignedTo);
                const isLoading = loadingTaskId === task.id;
                const completed = hasResult(task.id);

                return (
                  <Button
                    key={task.id}
                    variant={completed ? "secondary" : "outline"}
                    size="sm"
                    disabled={isLoading}
                    onClick={() => onExecuteTask(task)}
                    className="h-auto py-2 px-3"
                    title={task.description}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : completed ? (
                      <FileText className="h-3 w-3 mr-2 text-green-500" />
                    ) : (
                      <FileText className="h-3 w-3 mr-2" />
                    )}
                    <span>{task.label}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {member?.name || task.assignedTo}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {/* Task Results */}
            {taskResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Completed Deliverables</h4>
                {taskResults.map((result, idx) => (
                  <Card key={`result-${idx}-${result.id}`} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{result.member}</Badge>
                      <CopyButton content={result.content} />
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                      {result.content}
                    </pre>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Wrap with error boundary
export const QuickTasks: React.FC<QuickTasksProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Tasks Unavailable"
    fallbackMessage="The quick tasks section encountered an error. Other boardroom features should still work."
  >
    <QuickTasksContent {...props} />
  </BoardroomErrorBoundary>
);

export default QuickTasks;
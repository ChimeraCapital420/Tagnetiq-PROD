// FILE: src/features/boardroom/components/TaskDashboard/TaskCreator.tsx
// ═══════════════════════════════════════════════════════════════════════
// CUSTOM TASK CREATOR — Collapsible form for creating new tasks
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { TASK_TYPES } from './constants';
import type { BoardMember, TaskPriority, CreateTaskParams, BoardroomTask } from './types';

interface TaskCreatorProps {
  members: BoardMember[];
  onSubmit: (params: CreateTaskParams) => Promise<BoardroomTask | null>;
}

export const TaskCreator: React.FC<TaskCreatorProps> = ({ members, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [taskType, setTaskType] = useState('custom');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [executeNow, setExecuteNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = members.filter(m => m.is_active !== false);
  const canSubmit = title.trim().length > 0 && assignedTo.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const result = await onSubmit({
      assigned_to: assignedTo,
      title: title.trim(),
      description: description.trim() || undefined,
      task_type: taskType,
      priority,
      execute_now: executeNow,
    });

    setSubmitting(false);

    if (result) {
      // Reset form
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setTaskType('custom');
      setPriority('normal');
      setOpen(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          Custom Task
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Title */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Task Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Analyze competitor pricing models"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Additional context or requirements..."
                className="min-h-[60px] max-h-24 resize-none text-sm"
                maxLength={1000}
              />
            </div>

            {/* Row: Assign + Type + Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Assign to */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Assign To *</label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                >
                  <option value="">Select member...</option>
                  {activeMembers.map(m => (
                    <option key={m.slug} value={m.slug}>{m.name} — {m.title}</option>
                  ))}
                </select>
              </div>

              {/* Task type */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Type</label>
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                >
                  {TASK_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Execute now toggle + submit */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={executeNow}
                  onChange={e => setExecuteNow(e.target.checked)}
                  className="rounded"
                />
                <span className="text-muted-foreground">Execute immediately</span>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                size="sm"
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {executeNow ? 'Create & Execute' : 'Create Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
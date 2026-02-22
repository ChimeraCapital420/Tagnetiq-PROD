// FILE: src/features/boardroom/components/TaskDashboard/TaskCard.tsx
// ═══════════════════════════════════════════════════════════════════════
// TASK CARD — Individual task with status, deliverable, and actions
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, CheckCircle2, Eye, MessageSquare,
  Trash2, RotateCcw,
} from 'lucide-react';
import { BoardMemberAvatar } from '../BoardMemberAvatar';
import { STATUS_CONFIG, PRIORITY_CONFIG, relativeTime, CopyButton } from './constants';
import type { BoardMember, BoardroomTask } from './types';

interface TaskCardProps {
  task: BoardroomTask;
  member: BoardMember | undefined;
  onUpdate: (id: string, action: string, feedback?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, member, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [acting, setActing] = useState(false);

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const hasDeliverable = !!task.deliverable_content;

  const handleAction = async (action: string, fb?: string) => {
    setActing(true);
    await onUpdate(task.id, action, fb);
    setActing(false);
    setFeedbackOpen(false);
    setFeedback('');
  };

  return (
    <div className={`rounded-lg border p-3 transition-all ${statusCfg.bg}`}>
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        {/* Member avatar */}
        {member && <BoardMemberAvatar member={member} size="sm" />}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-medium truncate">{task.title}</p>
            <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
              {statusCfg.label}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${priorityCfg.color}`}>
              {priorityCfg.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            {member && <span>{member.name}</span>}
            <span>·</span>
            <span>{task.task_type.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>{relativeTime(task.created_at)}</span>
            {task.completed_at && (
              <>
                <span>·</span>
                <span className="text-green-400">Done {relativeTime(task.completed_at)}</span>
              </>
            )}
          </div>
        </div>

        {/* Expand / actions */}
        <div className="flex items-center gap-1 shrink-0">
          {hasDeliverable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setExpanded(!expanded)}
              title="View deliverable"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Description (always visible if short) */}
      {task.description && task.description !== task.title && (
        <p className="text-xs text-muted-foreground mt-1.5 ml-9 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* CEO feedback if present */}
      {task.ceo_feedback && (
        <div className="mt-2 ml-9 p-2 rounded bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 font-medium mb-0.5">CEO Feedback</p>
          <p className="text-xs text-muted-foreground">{task.ceo_feedback}</p>
        </div>
      )}

      {/* Expanded deliverable */}
      {expanded && hasDeliverable && (
        <div className="mt-2 ml-9">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground font-medium uppercase">Deliverable</p>
            <CopyButton content={task.deliverable_content!} />
          </div>
          <ScrollArea className="max-h-60">
            <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">
              {task.deliverable_content}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Feedback input */}
      {feedbackOpen && (
        <div className="mt-2 ml-9 space-y-2">
          <Textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Describe what needs to change..."
            className="min-h-[60px] max-h-24 resize-none text-xs"
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              disabled={!feedback.trim() || acting}
              onClick={() => handleAction('request_revision', feedback.trim())}
            >
              {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
              Send Revision
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(task.status === 'completed' || task.status === 'pending' || task.status === 'in_progress') && (
        <div className="flex items-center gap-1.5 mt-2 ml-9 flex-wrap">
          {task.status === 'completed' && !feedbackOpen && (
            <>
              <Button
                size="sm" variant="ghost" className="text-xs h-7 gap-1"
                onClick={() => handleAction('approve')}
                disabled={acting}
              >
                <CheckCircle2 className="h-3 w-3 text-green-400" /> Approve
              </Button>
              <Button
                size="sm" variant="ghost" className="text-xs h-7 gap-1"
                onClick={() => setFeedbackOpen(true)}
              >
                <MessageSquare className="h-3 w-3" /> Request Revision
              </Button>
            </>
          )}
          {(task.status === 'pending' || task.status === 'in_progress') && (
            <Button
              size="sm" variant="ghost" className="text-xs h-7 gap-1 text-destructive"
              onClick={() => onDelete(task.id)}
              disabled={acting}
            >
              <Trash2 className="h-3 w-3" /> Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
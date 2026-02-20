// FILE: src/features/boardroom/components/TaskDashboard.tsx
// ═══════════════════════════════════════════════════════════════════════
// TASK DASHBOARD — Full Boardroom Task Management
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 8: Replaces the partial QuickTasks-only experience with a
// complete task lifecycle UI.
//
// Sections:
//   1. Status tabs — All | Pending | In Progress | Completed | Blocked
//   2. Quick Tasks — preset one-click tasks (existing pattern, embedded)
//   3. Custom Task Creator — title, member, type, priority, execute now
//   4. Task List — cards with status, member, deliverable preview
//   5. Deliverable Viewer — expandable markdown view + copy
//   6. Member Workload — per-member pending/completed counts
//   7. Task Actions — approve, request revision, cancel
//
// Mobile-first: single column, touch targets, collapsible sections.
// Desktop: 2-column layout (list + detail/workload sidebar).
//
// API: api/boardroom/tasks.ts — GET, POST, PATCH, DELETE (no changes)
// Hook: useTasks.ts — expanded with full CRUD
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, Loader2, CheckCircle2, Clock, AlertTriangle,
  XCircle, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, FileText, RefreshCw, Send, Briefcase,
  BarChart3, Eye, MessageSquare, Trash2, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { BoardMemberAvatar } from './BoardMemberAvatar';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type {
  BoardMember,
  BoardroomTask,
  TaskStatus,
  TaskPriority,
  CreateTaskParams,
  QuickTask,
  TaskResult,
  MemberWorkload,
} from '../types';
import {
  UI_CONFIG, QUICK_TASKS, AI_PROVIDER_COLORS,
  SUCCESS_MESSAGES, ERROR_MESSAGES,
} from '../constants';

// =============================================================================
// TYPES
// =============================================================================

interface TaskDashboardProps {
  /** Board members for assignment dropdown + avatar display */
  members: BoardMember[];
  /** Full task list from useTasks hook */
  tasks: BoardroomTask[];
  /** Whether task list is loading */
  isLoadingTasks: boolean;
  /** Current status filter */
  activeFilter: TaskStatus | 'all';
  /** Quick task results (legacy) */
  taskResults: TaskResult[];
  /** Which quick task is loading */
  loadingTaskId: string | null;
  /** Per-member workload data from boardroomData.tasks.by_member */
  memberWorkload?: Record<string, MemberWorkload>;
  /** Pending task count from stats */
  pendingCount?: number;
  /** Resolve slug → member */
  getMemberBySlug: (slug: string) => BoardMember | undefined;

  // Actions
  onFetchTasks: (filter?: TaskStatus | 'all') => Promise<void>;
  onSetFilter: (filter: TaskStatus | 'all') => void;
  onCreateTask: (params: CreateTaskParams) => Promise<BoardroomTask | null>;
  onExecuteQuickTask: (task: QuickTask) => Promise<void>;
  onUpdateTask: (id: string, action: string, feedback?: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onClearResults: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_TABS: Array<{ id: TaskStatus | 'all'; label: string; icon: React.ReactNode }> = [
  { id: 'all',         label: 'All',         icon: <Briefcase className="h-3 w-3" /> },
  { id: 'pending',     label: 'Pending',     icon: <Clock className="h-3 w-3" /> },
  { id: 'in_progress', label: 'Running',     icon: <Loader2 className="h-3 w-3" /> },
  { id: 'completed',   label: 'Completed',   icon: <CheckCircle2 className="h-3 w-3" /> },
  { id: 'blocked',     label: 'Blocked',     icon: <AlertTriangle className="h-3 w-3" /> },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Pending' },
  in_progress: { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   label: 'Running' },
  completed:   { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Completed' },
  blocked:     { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',      label: 'Blocked' },
  cancelled:   { color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  label: 'Cancelled' },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low:      { color: 'text-slate-400',  label: 'Low' },
  normal:   { color: 'text-blue-400',   label: 'Normal' },
  high:     { color: 'text-orange-400', label: 'High' },
  critical: { color: 'text-red-400',    label: 'Critical' },
};

const TASK_TYPES = [
  { value: 'custom',               label: 'Custom Task' },
  { value: 'social_media_posts',   label: 'Social Media Posts' },
  { value: 'competitive_analysis', label: 'Competitive Analysis' },
  { value: 'market_research',      label: 'Market Research' },
  { value: 'investor_narrative',   label: 'Investor Narrative' },
  { value: 'terms_of_service',     label: 'Terms of Service' },
  { value: 'privacy_policy',       label: 'Privacy Policy' },
  { value: 'financial_projections',label: 'Financial Projections' },
  { value: 'api_design',           label: 'API Design' },
];

// =============================================================================
// HELPERS
// =============================================================================

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// =============================================================================
// COPY BUTTON (reusable)
// =============================================================================

const CopyButton: React.FC<{ content: string; label?: string }> = ({ content, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);

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
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </Button>
  );
};

// =============================================================================
// STATUS FILTER TABS
// =============================================================================

const StatusTabs: React.FC<{
  active: TaskStatus | 'all';
  counts: Record<string, number>;
  onSelect: (filter: TaskStatus | 'all') => void;
}> = ({ active, counts, onSelect }) => (
  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
    {STATUS_TABS.map((tab) => {
      const count = tab.id === 'all'
        ? Object.values(counts).reduce((s, c) => s + c, 0)
        : (counts[tab.id] || 0);

      return (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
            whitespace-nowrap transition-all shrink-0
            ${active === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
        >
          {tab.icon}
          {tab.label}
          {count > 0 && (
            <span className={`
              text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center
              ${active === tab.id ? 'bg-primary-foreground/20' : 'bg-background'}
            `}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// =============================================================================
// CUSTOM TASK CREATOR
// =============================================================================

const TaskCreator: React.FC<{
  members: BoardMember[];
  onSubmit: (params: CreateTaskParams) => Promise<BoardroomTask | null>;
}> = ({ members, onSubmit }) => {
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

// =============================================================================
// TASK CARD — Individual task in the list
// =============================================================================

const TaskCard: React.FC<{
  task: BoardroomTask;
  member: BoardMember | undefined;
  onUpdate: (id: string, action: string, feedback?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({ task, member, onUpdate, onDelete }) => {
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

// =============================================================================
// MEMBER WORKLOAD SIDEBAR
// =============================================================================

const WorkloadSidebar: React.FC<{
  workload: Record<string, MemberWorkload>;
  members: BoardMember[];
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}> = ({ workload, members, getMemberBySlug }) => {
  const entries = Object.entries(workload)
    .map(([slug, w]) => ({ slug, ...w, member: getMemberBySlug(slug) }))
    .filter(e => e.member)
    .sort((a, b) => (b.pending + b.completed) - (a.pending + a.completed));

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Member Workload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(({ slug, pending, completed, member }) => {
          const total = pending + completed;
          const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <div key={slug} className="flex items-center gap-2">
              <BoardMemberAvatar member={member!} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{member!.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Progress bar */}
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${completedPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {completed}/{total}
                  </span>
                </div>
              </div>
              {pending > 0 && (
                <Badge variant="outline" className="text-[10px] text-yellow-400">
                  {pending} pending
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// QUICK TASKS SECTION (embedded preset buttons)
// =============================================================================

const QuickTaskSection: React.FC<{
  taskResults: TaskResult[];
  loadingTaskId: string | null;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
  onExecute: (task: QuickTask) => Promise<void>;
  onClearResults: () => void;
}> = ({ taskResults, loadingTaskId, getMemberBySlug, onExecute, onClearResults }) => {
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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const TaskDashboardContent: React.FC<TaskDashboardProps> = ({
  members,
  tasks,
  isLoadingTasks,
  activeFilter,
  taskResults,
  loadingTaskId,
  memberWorkload,
  pendingCount,
  getMemberBySlug,
  onFetchTasks,
  onSetFilter,
  onCreateTask,
  onExecuteQuickTask,
  onUpdateTask,
  onDeleteTask,
  onClearResults,
}) => {
  // Fetch tasks on mount
  useEffect(() => {
    onFetchTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute status counts from current tasks
  const statusCounts: Record<string, number> = {};
  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Tasks
          {pendingCount !== undefined && pendingCount > 0 && (
            <Badge variant="outline" className="text-xs text-yellow-400">
              {pendingCount} pending
            </Badge>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFetchTasks()}
          disabled={isLoadingTasks}
          className="gap-1.5 h-7 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${isLoadingTasks ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status tabs */}
      <StatusTabs
        active={activeFilter}
        counts={statusCounts}
        onSelect={onSetFilter}
      />

      {/* Action bar: Quick Tasks + Custom Task Creator */}
      <div className="flex flex-wrap gap-2">
        <QuickTaskSection
          taskResults={taskResults}
          loadingTaskId={loadingTaskId}
          getMemberBySlug={getMemberBySlug}
          onExecute={onExecuteQuickTask}
          onClearResults={onClearResults}
        />
        <TaskCreator members={members} onSubmit={onCreateTask} />
      </div>

      {/* Main content: task list + optional sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task list (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-2">
          {isLoadingTasks && tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm">Loading tasks...</p>
              </CardContent>
            </Card>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks{activeFilter !== 'all' ? ` with status "${activeFilter}"` : ''}</p>
                <p className="text-xs mt-1">Use Quick Tasks or create a custom task above</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2 pr-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    member={getMemberBySlug(task.assigned_to)}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Workload sidebar (1/3 on desktop, full width mobile) */}
        <div className="space-y-4">
          {memberWorkload && Object.keys(memberWorkload).length > 0 && (
            <WorkloadSidebar
              workload={memberWorkload}
              members={members}
              getMemberBySlug={getMemberBySlug}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const TaskDashboard: React.FC<TaskDashboardProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Task Dashboard Unavailable"
    fallbackMessage="The task dashboard encountered an error. Try refreshing the page."
  >
    <TaskDashboardContent {...props} />
  </BoardroomErrorBoundary>
);

export default TaskDashboard;
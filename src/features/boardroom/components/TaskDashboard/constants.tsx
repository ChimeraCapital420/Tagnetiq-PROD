// FILE: src/features/boardroom/components/TaskDashboard/constants.tsx
// ═══════════════════════════════════════════════════════════════════════
// TASK DASHBOARD CONSTANTS & SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle2, Clock, AlertTriangle,
  Briefcase, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { SUCCESS_MESSAGES } from '../../constants';
import type { TaskStatus } from './types';

// ============================================================================
// STATUS TABS CONFIG
// ============================================================================

export const STATUS_TABS: Array<{ id: TaskStatus | 'all'; label: string; icon: React.ReactNode }> = [
  { id: 'all',         label: 'All',         icon: <Briefcase className="h-3 w-3" /> },
  { id: 'pending',     label: 'Pending',     icon: <Clock className="h-3 w-3" /> },
  { id: 'in_progress', label: 'Running',     icon: <Loader2 className="h-3 w-3" /> },
  { id: 'completed',   label: 'Completed',   icon: <CheckCircle2 className="h-3 w-3" /> },
  { id: 'blocked',     label: 'Blocked',     icon: <AlertTriangle className="h-3 w-3" /> },
];

// ============================================================================
// STATUS & PRIORITY DISPLAY CONFIG
// ============================================================================

export const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Pending' },
  in_progress: { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   label: 'Running' },
  completed:   { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Completed' },
  blocked:     { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',      label: 'Blocked' },
  cancelled:   { color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  label: 'Cancelled' },
};

export const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low:      { color: 'text-slate-400',  label: 'Low' },
  normal:   { color: 'text-blue-400',   label: 'Normal' },
  high:     { color: 'text-orange-400', label: 'High' },
  critical: { color: 'text-red-400',    label: 'Critical' },
};

// ============================================================================
// TASK TYPE OPTIONS
// ============================================================================

export const TASK_TYPES = [
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

// ============================================================================
// HELPERS
// ============================================================================

export function relativeTime(iso: string | null): string {
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

// ============================================================================
// COPY BUTTON (reusable across sub-components)
// ============================================================================

export const CopyButton: React.FC<{ content: string; label?: string }> = ({ content, label = 'Copy' }) => {
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
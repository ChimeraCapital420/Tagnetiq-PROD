// FILE: src/features/boardroom/components/CommitteePanel.tsx
// ═══════════════════════════════════════════════════════════════════════
// Committee Meeting Panel — Dedicated 2-4 Member UI
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 7 Gap #4: Missing dedicated committee UI.
// Previously, committee meetings routed through the generic ChatArea.
// This component adds:
//   - Visual member selection (2-4 members with validation)
//   - Per-member loading states with avatar indicators
//   - Quick-start presets for common committee combos
//   - Stacked on mobile, grid on desktop
//
// Mobile-first: touch-friendly selection targets, stacked layout.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Loader2, MessageSquare, Check,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { MessageBubble, LoadingBubble } from './MessageBubble';
import { BoardMemberAvatar } from './BoardMemberAvatar';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type { Meeting, Message, BoardMember } from '../types';
import { UI_CONFIG, AI_PROVIDER_COLORS } from '../constants';

// =============================================================================
// TYPES
// =============================================================================

interface CommitteePanelProps {
  members: BoardMember[];
  activeMeeting: Meeting | null;
  messages: Message[];
  loadingResponses: string[];
  sending: boolean;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onCreateCommittee: (title: string, memberSlugs: string[]) => void;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

// Common committee presets — only shown if all members exist
const COMMITTEE_PRESETS = [
  { label: 'Growth', slugs: ['athena', 'echo', 'flux'], icon: '📈' },
  { label: 'Technical', slugs: ['forge', 'cipher', 'nexus'], icon: '⚙️' },
  { label: 'Finance', slugs: ['griffin', 'sage', 'athena'], icon: '💰' },
  { label: 'Creative', slugs: ['echo', 'aurora', 'muse'], icon: '🎨' },
];

// =============================================================================
// MEMBER SELECTOR
// =============================================================================

const MemberSelector: React.FC<{
  members: BoardMember[];
  selected: string[];
  onToggle: (slug: string) => void;
  onPreset: (slugs: string[]) => void;
}> = ({ members, selected, onToggle, onPreset }) => {
  const activeMembers = members.filter(m => m.is_active !== false);

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
          Quick Presets
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMITTEE_PRESETS.map((preset) => {
            const allExist = preset.slugs.every(s => activeMembers.some(m => m.slug === s));
            if (!allExist) return null;

            const isActive = preset.slugs.every(s => selected.includes(s))
              && selected.length === preset.slugs.length;

            return (
              <Button
                key={preset.label}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPreset(preset.slugs)}
                className="gap-1.5 text-xs"
              >
                <span>{preset.icon}</span>
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Member grid — 2 cols mobile, 3 cols desktop */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
          Select 2–4 Members ({selected.length} selected)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeMembers.map((member) => {
            const isSelected = selected.includes(member.slug);
            const providerColor = AI_PROVIDER_COLORS[member.ai_provider] || '';

            return (
              <button
                key={member.slug}
                onClick={() => onToggle(member.slug)}
                className={`
                  relative p-3 rounded-lg border text-left transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <BoardMemberAvatar member={member} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{member.title}</p>
                  </div>
                </div>

                <Badge variant="outline" className={`text-[10px] mt-1 ${providerColor}`}>
                  {member.ai_provider}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// COMMITTEE HEADER
// =============================================================================

const CommitteeHeader: React.FC<{
  meeting: Meeting;
  members: BoardMember[];
}> = ({ meeting, members }) => {
  const participants = useMemo(() => {
    if (meeting.participant_details) return meeting.participant_details;
    if (meeting.participants) {
      return meeting.participants
        .map(id => members.find(m => m.id === id))
        .filter(Boolean) as BoardMember[];
    }
    return [];
  }, [meeting, members]);

  return (
    <div className="p-3 border-b">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate">{meeting.title}</h2>
          <p className="text-xs text-muted-foreground">Committee Meeting</p>
        </div>
        <Badge variant={meeting.status === 'active' ? 'default' : 'secondary'} className="text-xs">
          {meeting.status}
        </Badge>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {participants.map((p) => (
          <div key={p.id || p.slug} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
              {p.name?.[0]}
            </div>
            <span className="text-muted-foreground">{p.name?.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const CommitteePanelContent: React.FC<CommitteePanelProps> = ({
  members,
  activeMeeting,
  messages,
  loadingResponses,
  sending,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onCreateCommittee,
  getMemberBySlug,
}) => {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canCreate = selectedSlugs.length >= 2 && selectedSlugs.length <= 4 && title.trim().length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: UI_CONFIG.scrollBehavior });
  }, [messages, loadingResponses]);

  const toggleMember = (slug: string) => {
    setSelectedSlugs(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 4) return prev;
      return [...prev, slug];
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // ── Selection mode ────────────────────────────────────
  if (!activeMeeting) {
    return (
      <Card className="h-[60vh] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            New Committee Meeting
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">
              Meeting Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Q2 Growth Strategy"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              maxLength={100}
            />
          </div>

          <MemberSelector
            members={members}
            selected={selectedSlugs}
            onToggle={toggleMember}
            onPreset={setSelectedSlugs}
          />
        </CardContent>

        <div className="p-4 border-t">
          <Button onClick={() => { if (canCreate) onCreateCommittee(title.trim(), selectedSlugs); }} disabled={!canCreate} className="w-full gap-2">
            <Sparkles className="h-4 w-4" />
            Start Committee ({selectedSlugs.length} members)
          </Button>
          {selectedSlugs.length === 1 && (
            <p className="text-xs text-destructive text-center mt-2">Select at least 2 members</p>
          )}
        </div>
      </Card>
    );
  }

  // ── Active meeting ────────────────────────────────────
  return (
    <Card className="h-[60vh] flex flex-col">
      <CommitteeHeader meeting={activeMeeting} members={members} />

      {/* Collapsible selector toggle */}
      <button
        onClick={() => setSelectorOpen(!selectorOpen)}
        className="px-3 py-1.5 border-b text-xs text-muted-foreground flex items-center gap-1 hover:bg-muted/50"
      >
        {selectorOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {selectorOpen ? 'Hide' : 'Show'} member panel
      </button>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => {
            const member = msg.member_slug ? getMemberBySlug(msg.member_slug) : undefined;
            return <MessageBubble key={msg.id} message={msg} member={member} />;
          })}

          {loadingResponses.map((slug) => {
            const member = getMemberBySlug(slug);
            if (!member) return null;
            return <LoadingBubble key={`loading-${slug}`} member={member} />;
          })}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {activeMeeting.status === 'active' && (
        <div className="p-3 border-t">
          <form onSubmit={(e) => { e.preventDefault(); onSendMessage(); }} className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              placeholder="Address the committee..."
              disabled={sending}
              className="flex-1 min-h-[44px] max-h-24 resize-none text-sm"
              maxLength={UI_CONFIG.maxMessageLength}
              onKeyDown={handleKeyDown}
            />
            <Button type="submit" disabled={sending || !newMessage.trim()} size="sm" className="self-end">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
};

export const CommitteePanel: React.FC<CommitteePanelProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Committee Unavailable"
    fallbackMessage="The committee panel encountered an error. Try refreshing."
  >
    <CommitteePanelContent {...props} />
  </BoardroomErrorBoundary>
);

export default CommitteePanel;
// FILE: src/features/boardroom/components/ChatArea.tsx
// Main chat area component
//
// v2.0: Replaced inline MessageInput with full ChatInput component.
//
//   WHY: The original inline MessageInput was a basic textarea + send button.
//   ChatInput (v2.0) adds:
//     - Document reading (PDF, DOCX, TXT) — client-side, zero server cost
//     - Web research via Perplexity sonar-pro — domain-filtered per member
//     - Voice input — existing useVoiceInput hook wired in
//     - Media attachment preview strip before send
//     - Attachment-only sends (document with no message text)
//
//   The old MessageInput component is removed entirely — ChatInput
//   manages its own state internally. onSendMessage signature updated
//   to accept optional mediaAttachments alongside message text.
//
//   BACKWARD COMPAT: newMessage and onNewMessageChange kept as optional
//   props so any parent components not yet updated don't break.

import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus } from 'lucide-react';
import { MessageBubble, LoadingBubble } from './MessageBubble';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import { ChatInput } from './ChatInput';
import type { Meeting, Message, BoardMember } from '../types';
import { UI_CONFIG } from '../constants';
import type { MediaAttachment } from '../../../../api/boardroom/lib/prompt-builder/media-context.js';

// =============================================================================
// TYPES
// =============================================================================

interface ChatAreaProps {
  activeMeeting: Meeting | null;
  messages: Message[];
  loadingResponses: string[];
  sending: boolean;
  // v2.0: Updated signature — accepts message text + optional media attachments
  onSendMessage: (message: string, mediaAttachments?: MediaAttachment[]) => void;
  onStartMeeting: () => void;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
  // v2.0: Active member for 1:1 chats — passed to ChatInput so URL research
  // is domain-filtered (CFO gets cash flow, Legal gets liability, etc.)
  activeMember?: BoardMember | null;
  // Optional: kept for backward compat — ChatInput manages its own state
  newMessage?: string;
  onNewMessageChange?: (value: string) => void;
  className?: string;
}

// =============================================================================
// EMPTY STATE
// =============================================================================

const EmptyState: React.FC<{ onStartMeeting: () => void }> = ({ onStartMeeting }) => (
  <div className="flex-1 flex items-center justify-center text-muted-foreground">
    <div className="text-center">
      <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium mb-2">Welcome to the Boardroom</p>
      <p className="text-sm mb-4">Start a new meeting or select one from history</p>
      <Button onClick={onStartMeeting} className="gap-2">
        <Plus className="h-4 w-4" />
        Start Meeting
      </Button>
    </div>
  </div>
);

// =============================================================================
// MEETING HEADER
// =============================================================================

const MeetingHeader: React.FC<{ meeting: Meeting }> = ({ meeting }) => (
  <div className="p-4 border-b flex items-center justify-between">
    <div>
      <h2 className="font-semibold">{meeting.title}</h2>
      <p className="text-sm text-muted-foreground capitalize">
        {meeting.meeting_type.replace('_', ' ')}
      </p>
    </div>
    <Badge variant={meeting.status === 'active' ? 'default' : 'secondary'}>
      {meeting.status}
    </Badge>
  </div>
);

// =============================================================================
// CHAT AREA CONTENT
// =============================================================================

const ChatAreaContent: React.FC<ChatAreaProps> = ({
  activeMeeting,
  messages,
  loadingResponses,
  sending,
  onSendMessage,
  onStartMeeting,
  getMemberBySlug,
  activeMember,
  className,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: UI_CONFIG.scrollBehavior });
  }, [messages, loadingResponses]);

  // Derive a contextual placeholder based on meeting type
  const inputPlaceholder = activeMeeting
    ? activeMeeting.meeting_type === 'full_board'
      ? 'Message the full board... (📎 attach docs or URLs)'
      : activeMeeting.meeting_type === 'committee'
      ? 'Message the committee... (📎 attach docs or URLs)'
      : activeMeeting.meeting_type === 'vote'
      ? 'Call a vote...'
      : activeMeeting.meeting_type === 'devils_advocate'
      ? 'Present your idea for challenge...'
      : activeMeeting.meeting_type === 'executive_session'
      ? 'Executive session — confidential...'
      : activeMember
      ? `Message ${activeMember.name}... (📎 attach docs or URLs)`
      : 'Ask your board of advisors...'
    : 'Ask your board of advisors...';

  return (
    <div className={className}>
      <Card className="h-[60vh] flex flex-col">
        {activeMeeting ? (
          <>
            <MeetingHeader meeting={activeMeeting} />

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Messages */}
                {messages.map((msg) => {
                  const member = msg.member_slug ? getMemberBySlug(msg.member_slug) : undefined;
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      member={member}
                    />
                  );
                })}

                {/* Loading indicators for pending responses */}
                {loadingResponses.map((slug) => {
                  const member = getMemberBySlug(slug);
                  if (!member) return null;
                  return <LoadingBubble key={`loading-${slug}`} member={member} />;
                })}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* v2.0: ChatInput replaces the old MessageInput.
                Handles voice, document reading, URL research, and image capture.
                Only shown for active meetings — concluded meetings are read-only. */}
            {activeMeeting.status === 'active' && (
              <ChatInput
                onSend={onSendMessage}
                placeholder={inputPlaceholder}
                disabled={sending}
                isLoading={sending}
                activeMember={activeMember || null}
              />
            )}

            {/* Concluded meeting notice */}
            {activeMeeting.status === 'concluded' && (
              <div className="p-3 border-t text-center text-xs text-muted-foreground">
                This meeting has concluded. Start a new meeting to continue.
              </div>
            )}
          </>
        ) : (
          <EmptyState onStartMeeting={onStartMeeting} />
        )}
      </Card>
    </div>
  );
};

// =============================================================================
// WRAP WITH ERROR BOUNDARY
// =============================================================================

export const ChatArea: React.FC<ChatAreaProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Chat Unavailable"
    fallbackMessage="The chat area encountered an error. Try refreshing the page."
  >
    <ChatAreaContent {...props} />
  </BoardroomErrorBoundary>
);

export default ChatArea;
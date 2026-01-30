// FILE: src/features/boardroom/components/ChatArea.tsx
// Main chat area component

import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Users, Plus } from 'lucide-react';
import { MessageBubble, LoadingBubble } from './MessageBubble';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type { Meeting, Message, BoardMember } from '../types';
import { UI_CONFIG } from '../constants';

interface ChatAreaProps {
  activeMeeting: Meeting | null;
  messages: Message[];
  loadingResponses: string[];
  sending: boolean;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onStartMeeting: () => void;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

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

const MessageInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
}> = ({ value, onChange, onSend, sending, disabled }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 border-t">
      <form 
        onSubmit={(e) => { e.preventDefault(); onSend(); }} 
        className="flex gap-2"
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Address the board..."
          disabled={sending}
          className="flex-1 min-h-[44px] max-h-32 resize-none"
          maxLength={UI_CONFIG.maxMessageLength}
          onKeyDown={handleKeyDown}
        />
        <Button 
          type="submit" 
          disabled={disabled}
          className="self-end"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
};

const ChatAreaContent: React.FC<ChatAreaProps> = ({
  activeMeeting,
  messages,
  loadingResponses,
  sending,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onStartMeeting,
  getMemberBySlug,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: UI_CONFIG.scrollBehavior });
  }, [messages, loadingResponses]);

  return (
    <div className="lg:col-span-3">
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

            {/* Message input (only for active meetings) */}
            {activeMeeting.status === 'active' && (
              <MessageInput
                value={newMessage}
                onChange={onNewMessageChange}
                onSend={onSendMessage}
                sending={sending}
                disabled={sending || !newMessage.trim()}
              />
            )}
          </>
        ) : (
          <EmptyState onStartMeeting={onStartMeeting} />
        )}
      </Card>
    </div>
  );
};

// Wrap with error boundary
export const ChatArea: React.FC<ChatAreaProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Chat Unavailable"
    fallbackMessage="The chat area encountered an error. Try refreshing the page."
  >
    <ChatAreaContent {...props} />
  </BoardroomErrorBoundary>
);

export default ChatArea;
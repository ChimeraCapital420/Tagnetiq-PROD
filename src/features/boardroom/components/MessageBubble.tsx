// FILE: src/features/boardroom/components/MessageBubble.tsx
// Individual message bubble component
//
// v2.0: Attachment chip rendering
//   User messages that include attachments (docs, URLs, images) now show
//   a styled chip instead of raw emoji text. The attachment label in the
//   message content is parsed and rendered as a distinct visual element.
//   Board member responses are unchanged.

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Globe, Camera } from 'lucide-react';
import { VoiceButton } from './VoiceButton';
import { cn } from '@/lib/utils';
import type { Message, BoardMember } from '../types';
import { AI_PROVIDER_COLORS } from '../constants';

// =============================================================================
// TYPES
// =============================================================================

interface MessageBubbleProps {
  message: Message;
  member?: BoardMember;
}

// =============================================================================
// ATTACHMENT PARSER
// =============================================================================

/**
 * Parse the message content to extract the text and attachment info.
 * Content from useMeeting.sendMessage looks like:
 *   "What do you think?\n📎 2 attachments"
 *   "📎 1 attachment"
 *   "📎 Sending attachment..."
 *
 * Returns: { text, attachmentCount, hasAttachment }
 */
function parseMessageContent(content: string): {
  text: string;
  attachmentLine: string | null;
} {
  const lines = content.split('\n');
  const attachmentLineIndex = lines.findIndex(l => l.trim().startsWith('📎'));

  if (attachmentLineIndex === -1) {
    return { text: content, attachmentLine: null };
  }

  const text = lines.slice(0, attachmentLineIndex).join('\n').trim();
  const attachmentLine = lines[attachmentLineIndex].trim();

  return { text, attachmentLine };
}

/**
 * Determine icon for attachment chip based on content hint.
 * Falls back to FileText for unknown types.
 */
function AttachmentChip({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const isUrl      = lower.includes('url') || lower.includes('web') || lower.includes('research');
  const isImage    = lower.includes('image') || lower.includes('photo');
  const isQueued   = lower.includes('queued') || lower.includes('waiting');
  const isSending  = lower.includes('sending');

  const Icon = isUrl ? Globe : isImage ? Camera : FileText;

  // Strip the 📎 emoji from label for display
  const displayLabel = label.replace('📎', '').trim();

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs mt-1',
      isQueued
        ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
        : isSending
        ? 'bg-muted text-muted-foreground border border-border/30'
        : 'bg-primary/15 text-primary border border-primary/20',
    )}>
      <Icon className="w-3 h-3 flex-none" />
      <span>{displayLabel}</span>
    </div>
  );
}

// =============================================================================
// MESSAGE BUBBLE
// =============================================================================

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, member }) => {
  const isUser = message.sender_type === 'user';

  // v2.0: Parse attachment info from user message content
  const { text, attachmentLine } = isUser
    ? parseMessageContent(message.content)
    : { text: message.content, attachmentLine: null };

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>

      {/* Avatar for board members */}
      {!isUser && member && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={member.avatar_url} alt={member.name} />
          <AvatarFallback>{member.name[0]}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn('max-w-[80%]', isUser && 'text-right')}>

        {/* Member info header */}
        {!isUser && member && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{member.name}</span>
            <Badge
              className={cn(
                'text-[10px]',
                AI_PROVIDER_COLORS[message.ai_provider || member.ai_provider]
              )}
            >
              {message.ai_provider || member.ai_provider}
            </Badge>
            <VoiceButton
              text={message.content}
              memberSlug={member.slug}
              memberName={member.name}
            />
          </div>
        )}

        {/* Message content bubble */}
        <div className={cn(
          'rounded-lg px-4 py-2 inline-block text-left',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
        )}>
          {/* Main text — only shown when there is text */}
          {text && (
            <p className="whitespace-pre-wrap">{text}</p>
          )}

          {/* v2.0: Attachment chip — replaces raw emoji text */}
          {attachmentLine && (
            <AttachmentChip label={attachmentLine} />
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// LOADING BUBBLE
// =============================================================================

// Loading indicator for pending responses
interface LoadingBubbleProps {
  member: BoardMember;
}

export const LoadingBubble: React.FC<LoadingBubbleProps> = ({ member }) => (
  <div className="flex gap-3">
    <Avatar className="h-10 w-10 flex-shrink-0">
      <AvatarImage src={member.avatar_url} alt={member.name} />
      <AvatarFallback>{member.name[0]}</AvatarFallback>
    </Avatar>
    <div>
      <p className="text-sm font-medium mb-1">{member.name}</p>
      <div className="bg-muted rounded-lg px-4 py-2 inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Thinking...</span>
      </div>
    </div>
  </div>
);

export default MessageBubble;
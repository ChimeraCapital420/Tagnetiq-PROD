// FILE: src/features/boardroom/components/MessageBubble.tsx
// Individual message bubble component

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { VoiceButton } from './VoiceButton';
import { cn } from '@/lib/utils';
import type { Message, BoardMember } from '../types';
import { AI_PROVIDER_COLORS } from '../constants';

interface MessageBubbleProps {
  message: Message;
  member?: BoardMember;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, member }) => {
  const isUser = message.sender_type === 'user';

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar for board members */}
      {!isUser && member && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={member.avatar_url} alt={member.name} />
          <AvatarFallback>{member.name[0]}</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("max-w-[80%]", isUser && "text-right")}>
        {/* Member info header */}
        {!isUser && member && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{member.name}</span>
            <Badge 
              className={cn(
                "text-[10px]", 
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
        
        {/* Message content */}
        <div className={cn(
          "rounded-lg px-4 py-2 inline-block text-left",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
};

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
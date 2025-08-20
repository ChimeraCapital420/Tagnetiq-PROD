// FILE: src/components/arena/ConversationList.tsx

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  listing: { item_name: string };
  buyer: { screen_name: string };
  seller: { screen_name: string };
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({ conversations, selectedConversationId, onSelectConversation, currentUserId }) => {
  return (
    <div className="flex flex-col gap-2">
      {conversations.map(convo => {
        const otherUser = convo.buyer.id === currentUserId ? convo.seller : convo.buyer;
        return (
          <button
            key={convo.id}
            onClick={() => onSelectConversation(convo.id)}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg text-left transition-colors w-full",
              selectedConversationId === convo.id ? "bg-muted" : "hover:bg-muted/50"
            )}
          >
            <Avatar>
              <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${otherUser.screen_name}`} />
              <AvatarFallback>{otherUser.screen_name?.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="font-semibold">{otherUser.screen_name}</p>
              <p className="text-sm text-muted-foreground truncate">{convo.listing.item_name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
// FILE: src/components/arena/MessagesDropdown.tsx
// v2 — Handles direct + listing + system conversations with correct schema.
// Replaces the v1 file that expected the legacy buyer_id/seller_id/listing.item_name shape.
//
// Changes from v1:
//   - Uses new conversation shape from /api/arena/conversations: { conversation_type, other_user, listing | null, ... }
//   - Visually distinguishes direct messages, listing chats, and system messages
//   - Highlights TagnetIQ Official (system role) with a verified badge
//   - Removes false encryption claims from the UI

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare, Package, Loader2, User, BadgeCheck, Megaphone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  conversation_type: 'listing' | 'direct';
  listing_id: string | null;
  listing: {
    id: string;
    item_name: string;
    primary_photo_url: string;
  } | null;
  other_user: {
    id: string;
    screen_name: string;
    avatar_url?: string;
    role?: string;
  };
  last_message: {
    encrypted_content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
  is_buyer?: boolean;
  updated_at: string;
}

const MessagesDropdown: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/arena/conversations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      const list: Conversation[] = data.conversations || data || [];

      // Sort by most recent activity, prioritize unread
      const sorted = [...list].sort((a, b) => {
        if ((b.unread_count || 0) !== (a.unread_count || 0)) {
          return (b.unread_count || 0) - (a.unread_count || 0);
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setConversations(sorted.slice(0, 5));

      const unread = list.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setTotalUnread(unread);
    } catch (error) {
      console.error('[MessagesDropdown] fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [user, fetchConversations]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  const isSystem = (convo: Conversation) =>
    convo.other_user?.role === 'system' ||
    convo.other_user?.screen_name === 'TagnetIQ Official';

  const renderAvatar = (convo: Conversation) => {
    if (isSystem(convo)) {
      return (
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
      );
    }

    if (convo.conversation_type === 'direct') {
      return (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={convo.other_user.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {convo.other_user.screen_name?.slice(0, 2).toUpperCase() || '??'}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Listing conversation — show the item photo
    return (
      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {convo.listing?.primary_photo_url ? (
          <img
            src={convo.listing.primary_photo_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };

  const renderSubtitle = (convo: Conversation) => {
    if (isSystem(convo)) return 'Platform announcement';
    if (convo.conversation_type === 'direct') return 'Direct message';
    return convo.listing?.item_name || 'Listing chat';
  };

  if (!user) return null;

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchConversations()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <MessageSquare className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Messages</span>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalUnread} unread
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
          </div>
        ) : (
          <>
            {conversations.map((convo) => {
              const hasUnread = convo.unread_count > 0;
              const system = isSystem(convo);

              return (
                <DropdownMenuItem
                  key={convo.id}
                  className={cn(
                    'flex gap-3 p-3 cursor-pointer',
                    hasUnread && 'bg-primary/5',
                  )}
                  onClick={() => navigate(`/arena/messages?conversation=${convo.id}`)}
                >
                  {renderAvatar(convo)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm truncate flex items-center gap-1',
                          hasUnread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {!system && convo.conversation_type === 'direct' && (
                          <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{convo.other_user.screen_name}</span>
                        {system && (
                          <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        )}
                      </span>
                      {convo.last_message && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(convo.last_message.created_at)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {renderSubtitle(convo)}
                    </p>

                    {convo.last_message && (
                      <p
                        className={cn(
                          'text-xs truncate mt-0.5',
                          hasUnread ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {convo.last_message.sender_id === user?.id ? 'You: ' : ''}
                        {convo.last_message.encrypted_content}
                      </p>
                    )}
                  </div>

                  {hasUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 self-center" />
                  )}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center text-sm text-primary justify-center"
              onClick={() => navigate('/arena/messages')}
            >
              View all messages
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MessagesDropdown;
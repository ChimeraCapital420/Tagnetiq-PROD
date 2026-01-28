// FILE: src/components/arena/MessagesDropdown.tsx
// Navbar dropdown showing unread messages with notification badge

import React, { useState, useEffect } from 'react';
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
import { MessageSquare, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string;
  listing: {
    item_name: string;
    primary_photo_url: string;
  } | null;
  buyer: { id: string; screen_name: string };
  seller: { id: string; screen_name: string };
  last_message: {
    encrypted_content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
  is_seller: boolean;
}

const MessagesDropdown: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/arena/conversations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      setConversations(data.slice(0, 5)); // Show only 5 most recent
      
      // Calculate total unread
      const unread = data.reduce((sum: number, c: Conversation) => sum + (c.unread_count || 0), 0);
      setTotalUnread(unread);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
      // Poll for new messages every 30 seconds
      const interval = setInterval(fetchConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getOtherParty = (convo: Conversation) => {
    return convo.is_seller ? convo.buyer : convo.seller;
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
              const otherParty = getOtherParty(convo);
              const hasUnread = convo.unread_count > 0;
              
              return (
                <DropdownMenuItem
                  key={convo.id}
                  className={cn(
                    "flex gap-3 p-3 cursor-pointer",
                    hasUnread && "bg-primary/5"
                  )}
                  onClick={() => navigate(`/arena/messages?conversation=${convo.id}`)}
                >
                  {/* Listing thumbnail */}
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
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        hasUnread ? "font-semibold" : "font-medium"
                      )}>
                        {otherParty.screen_name}
                      </span>
                      {convo.last_message && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(convo.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {convo.listing?.item_name || 'Unknown Item'}
                    </p>
                    {convo.last_message && (
                      <p className={cn(
                        "text-xs truncate mt-0.5",
                        hasUnread ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {convo.last_message.sender_id === user?.id ? 'You: ' : ''}
                        {convo.last_message.encrypted_content}
                      </p>
                    )}
                  </div>
                  
                  {/* Unread indicator */}
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
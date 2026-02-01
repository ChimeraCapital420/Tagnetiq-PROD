// FILE: src/components/social/UserSearchModal.tsx
// Search for users to message or add as friends

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Search, X, UserPlus, MessageCircle, Loader2, Users,
  Clock, CheckCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResult {
  id: string;
  username: string;
  screen_name: string;
  full_name: string | null;
  avatar_url: string | null;
  is_friend?: boolean;
  has_pending_request?: boolean;
  is_incoming_request?: boolean;
  friendship_status?: string | null;
}

interface UserSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'message' | 'friend' | 'both';
  onSelectUser?: (user: SearchResult) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  open,
  onOpenChange,
  mode = 'both',
  onSelectUser,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.users || []);
    } catch (error: any) {
      console.error('Search error:', error);
      // Only show toast for non-empty queries
      if (query.length >= 2) {
        toast.error(error.message || 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (user: SearchResult) => {
    setActionLoading(`friend-${user.id}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const displayName = user.screen_name || user.username;
      if (data.auto_accepted) {
        toast.success(`You and ${displayName} are now friends!`);
      } else {
        toast.success('Friend request sent!');
      }

      // Update local state
      setResults(prev => prev.map(r => 
        r.id === user.id 
          ? { ...r, has_pending_request: true, friendship_status: 'pending' }
          : r
      ));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartConversation = async (user: SearchResult) => {
    setActionLoading(`message-${user.id}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/arena/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onOpenChange(false);
      navigate(`/arena/messages?conversation=${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectUser = (user: SearchResult) => {
    if (onSelectUser) {
      onSelectUser(user);
      onOpenChange(false);
    }
  };

  const getDisplayName = (user: SearchResult) => {
    return user.screen_name || user.username || 'Unknown';
  };

  const getInitials = (user: SearchResult) => {
    const name = user.screen_name || user.username || 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Find Users
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Search by username or email address
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter username or email..."
            className="pl-10 bg-zinc-900 border-zinc-800"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Avatar */}
                  <Avatar 
                    className="h-10 w-10 cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/user/${user.id}`);
                    }}
                  >
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-400">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & Status */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/user/${user.id}`);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {getDisplayName(user)}
                      </span>
                      {user.is_friend && (
                        <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">
                          <Users className="h-3 w-3 mr-1" />
                          Friend
                        </Badge>
                      )}
                    </div>
                    {user.full_name && (
                      <span className="text-xs text-zinc-500 truncate block">
                        {user.full_name}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Message Button */}
                    {(mode === 'message' || mode === 'both') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => onSelectUser ? handleSelectUser(user) : handleStartConversation(user)}
                        disabled={actionLoading === `message-${user.id}`}
                        title="Send message"
                      >
                        {actionLoading === `message-${user.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* Friend Button */}
                    {(mode === 'friend' || mode === 'both') && !user.is_friend && (
                      <>
                        {user.has_pending_request ? (
                          <Button size="sm" variant="ghost" disabled className="h-8 px-2">
                            <Clock className="h-4 w-4 mr-1" />
                            <span className="text-xs">Pending</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleSendFriendRequest(user)}
                            disabled={actionLoading === `friend-${user.id}`}
                            title="Send friend request"
                          >
                            {actionLoading === `friend-${user.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </>
                    )}

                    {(mode === 'friend' || mode === 'both') && user.is_friend && (
                      <CheckCircle className="h-4 w-4 text-green-400" title="Already friends" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="text-center py-8 text-zinc-500">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No users found for "{query}"</p>
              <p className="text-xs mt-1">Try a different username or email</p>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserSearchModal;
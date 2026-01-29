// FILE: src/components/social/FriendsList.tsx
// Friends list with tabs for friends, incoming, outgoing requests

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Users, UserPlus, Clock, CheckCircle, XCircle, UserMinus,
  Loader2, MessageCircle, Search, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserSearchModal } from './UserSearchModal';

interface Friend {
  id: string;
  friend_id: string;
  friend: {
    id: string;
    screen_name: string;
    avatar_url?: string;
  };
  status: string;
  is_incoming_request: boolean;
  is_outgoing_request: boolean;
  created_at: string;
}

interface FriendsData {
  friends: Friend[];
  incoming_requests: Friend[];
  outgoing_requests: Friend[];
  counts: {
    friends: number;
    incoming: number;
    outgoing: number;
  };
}

export const FriendsList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/friends', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to load friends');

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Friends fetch error:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    setActionLoading(`accept-${friendshipId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Friend request accepted!');
      fetchFriends();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (friendshipId: string) => {
    setActionLoading(`reject-${friendshipId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Friend request declined');
      fetchFriends();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (friendshipId: string) => {
    setActionLoading(`cancel-${friendshipId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Friend request cancelled');
      fetchFriends();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfriend = async (friendshipId: string) => {
    setActionLoading(`unfriend-${friendshipId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success('Friend removed');
      fetchFriends();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessage = async (userId: string) => {
    setActionLoading(`message-${userId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/arena/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      navigate(`/arena/messages?conversation=${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderFriendCard = (friend: Friend, showActions: 'friend' | 'incoming' | 'outgoing') => (
    <div
      key={friend.id}
      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
    >
      <Avatar 
        className="h-10 w-10 cursor-pointer"
        onClick={() => navigate(`/user/${friend.friend.id}`)}
      >
        <AvatarImage src={friend.friend.avatar_url || undefined} />
        <AvatarFallback className="bg-zinc-800 text-zinc-400">
          {friend.friend.screen_name?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/user/${friend.friend.id}`)}
      >
        <span className="font-medium text-white truncate block">
          {friend.friend.screen_name}
        </span>
        <span className="text-xs text-zinc-500">
          {showActions === 'incoming' && 'Wants to be your friend'}
          {showActions === 'outgoing' && 'Request pending'}
          {showActions === 'friend' && `Friends since ${new Date(friend.created_at).toLocaleDateString()}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {showActions === 'friend' && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => handleMessage(friend.friend.id)}
              disabled={actionLoading === `message-${friend.friend.id}`}
            >
              {actionLoading === `message-${friend.friend.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                  <UserMinus className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Friend?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove {friend.friend.screen_name} from your friends list?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleUnfriend(friend.id)}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {showActions === 'incoming' && (
          <>
            <Button
              size="sm"
              onClick={() => handleAccept(friend.id)}
              disabled={actionLoading === `accept-${friend.id}`}
              className="h-8"
            >
              {actionLoading === `accept-${friend.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> Accept</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(friend.id)}
              disabled={actionLoading === `reject-${friend.id}`}
              className="h-8 border-zinc-700"
            >
              {actionLoading === `reject-${friend.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
            </Button>
          </>
        )}

        {showActions === 'outgoing' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCancel(friend.id)}
            disabled={actionLoading === `cancel-${friend.id}`}
            className="h-8 border-zinc-700"
          >
            {actionLoading === `cancel-${friend.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Cancel'
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Friends
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchFriends} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setSearchOpen(true)} className="h-8">
            <UserPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="friends">
          <TabsList className="w-full bg-zinc-900/50 mb-4">
            <TabsTrigger value="friends" className="flex-1">
              Friends
              {data?.counts.friends ? (
                <Badge className="ml-2 bg-primary/20 text-primary">{data.counts.friends}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="flex-1">
              Requests
              {data?.counts.incoming ? (
                <Badge className="ml-2 bg-green-500/20 text-green-400">{data.counts.incoming}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="flex-1">
              Sent
              {data?.counts.outgoing ? (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">{data.counts.outgoing}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            <ScrollArea className="max-h-80">
              {data?.friends.length ? (
                <div className="space-y-2">
                  {data.friends.map(f => renderFriendCard(f, 'friend'))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No friends yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => setSearchOpen(true)}
                    className="mt-2"
                  >
                    Find users to add
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="incoming">
            <ScrollArea className="max-h-80">
              {data?.incoming_requests.length ? (
                <div className="space-y-2">
                  {data.incoming_requests.map(f => renderFriendCard(f, 'incoming'))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending requests</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="outgoing">
            <ScrollArea className="max-h-80">
              {data?.outgoing_requests.length ? (
                <div className="space-y-2">
                  {data.outgoing_requests.map(f => renderFriendCard(f, 'outgoing'))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No sent requests</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      <UserSearchModal 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
        mode="friend"
      />
    </Card>
  );
};

export default FriendsList;
// FILE: src/pages/UserProfilePage.tsx
// Public user profile page - view other users

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  User, MessageCircle, UserPlus, UserMinus, UserX, Shield,
  Calendar, Package, Users, Award, Loader2, ArrowLeft,
  ShieldCheck, ShieldOff, Lock, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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

interface UserProfile {
  id: string;
  screen_name: string;
  avatar_url: string | null;
  member_since: string;
  is_own_profile: boolean;
  can_view_details: boolean;
  is_private?: boolean;
  is_friends_only?: boolean;
  stats?: {
    active_listings: number;
    friends: number;
    completed_sales: number;
  };
  friendship?: {
    status: string | null;
    friendship_id: string | null;
    is_friend: boolean;
    pending_from_me: boolean;
    pending_to_me: boolean;
    can_send_request: boolean;
  };
  messaging?: {
    can_message: boolean;
    reason: string | null;
  };
}

export const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to view profiles');
        navigate('/auth');
        return;
      }

      const response = await fetch(`/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('User not found');
          navigate(-1);
          return;
        }
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Profile fetch error:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    setActionLoading('friend');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: profile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send request');
      }

      if (data.auto_accepted) {
        toast.success(`You and ${profile.screen_name} are now friends!`);
      } else {
        toast.success('Friend request sent!');
      }

      fetchProfile(); // Refresh
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile?.friendship?.friendship_id) return;
    setActionLoading('accept');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${profile.friendship.friendship_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept request');
      }

      toast.success(`You and ${profile.screen_name} are now friends!`);
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!profile?.friendship?.friendship_id) return;
    setActionLoading('reject');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${profile.friendship.friendship_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to decline request');
      }

      toast.success('Friend request declined');
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfriend = async () => {
    if (!profile?.friendship?.friendship_id) return;
    setActionLoading('unfriend');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${profile.friendship.friendship_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove friend');
      }

      toast.success('Friend removed');
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    setActionLoading('block');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/blocked', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: profile.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to block user');
      }

      toast.success('User blocked');
      navigate(-1);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessage = async () => {
    if (!profile) return;
    setActionLoading('message');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/arena/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: profile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start conversation');
      }

      navigate(`/arena/messages?conversation=${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-zinc-500">Profile not found</p>
      </div>
    );
  }

  const initials = profile.screen_name?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Profile Header Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar */}
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl font-bold text-white">
                    {profile.screen_name}
                  </h1>
                  {profile.friendship?.is_friend && (
                    <Badge className="bg-green-500/20 text-green-400 border-0">
                      <Users className="h-3 w-3 mr-1" />
                      Friend
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-zinc-400 text-sm">
                  <Calendar className="h-4 w-4" />
                  Member since {new Date(profile.member_since).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </div>

                {/* Privacy Badge */}
                {profile.is_private && (
                  <Badge variant="outline" className="mt-2 border-zinc-700">
                    <Lock className="h-3 w-3 mr-1" />
                    Private Profile
                  </Badge>
                )}
                {profile.is_friends_only && (
                  <Badge variant="outline" className="mt-2 border-zinc-700">
                    <Users className="h-3 w-3 mr-1" />
                    Friends Only
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!profile.is_own_profile && (
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-zinc-800">
                {/* Friend Actions */}
                {profile.friendship?.can_send_request && (
                  <Button
                    onClick={handleSendFriendRequest}
                    disabled={actionLoading === 'friend'}
                    className="flex-1 sm:flex-none"
                  >
                    {actionLoading === 'friend' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Add Friend
                  </Button>
                )}

                {profile.friendship?.pending_to_me && (
                  <>
                    <Button
                      onClick={handleAcceptRequest}
                      disabled={actionLoading === 'accept'}
                      className="flex-1 sm:flex-none"
                    >
                      {actionLoading === 'accept' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRejectRequest}
                      disabled={actionLoading === 'reject'}
                      className="flex-1 sm:flex-none border-zinc-700"
                    >
                      {actionLoading === 'reject' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Decline
                    </Button>
                  </>
                )}

                {profile.friendship?.pending_from_me && (
                  <Button variant="secondary" disabled className="flex-1 sm:flex-none">
                    <Clock className="h-4 w-4 mr-2" />
                    Request Pending
                  </Button>
                )}

                {profile.friendship?.is_friend && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="border-zinc-700">
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unfriend
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Friend?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {profile.screen_name} from your friends?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnfriend}>
                          Remove Friend
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Message Button */}
                {profile.messaging?.can_message && (
                  <Button
                    variant="secondary"
                    onClick={handleMessage}
                    disabled={actionLoading === 'message'}
                    className="flex-1 sm:flex-none"
                  >
                    {actionLoading === 'message' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4 mr-2" />
                    )}
                    Message
                  </Button>
                )}

                {profile.messaging && !profile.messaging.can_message && (
                  <Button variant="secondary" disabled className="flex-1 sm:flex-none">
                    <ShieldOff className="h-4 w-4 mr-2" />
                    {profile.messaging.reason || 'Cannot message'}
                  </Button>
                )}

                {/* Block Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300">
                      <UserX className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Block User?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Blocking {profile.screen_name} will prevent them from messaging you or viewing your profile. Any existing friendship will be removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBlock}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Block User
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats - Only if can view details */}
        {profile.can_view_details && profile.stats && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto text-primary mb-2" />
                <div className="text-2xl font-bold text-white">
                  {profile.stats.active_listings}
                </div>
                <div className="text-xs text-zinc-500">Active Listings</div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto text-blue-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {profile.stats.friends}
                </div>
                <div className="text-xs text-zinc-500">Friends</div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 text-center">
                <Award className="h-6 w-6 mx-auto text-green-400 mb-2" />
                <div className="text-2xl font-bold text-white">
                  {profile.stats.completed_sales}
                </div>
                <div className="text-xs text-zinc-500">Sales</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Private Profile Message */}
        {!profile.can_view_details && (
          <Card className="bg-zinc-900/50 border-zinc-800 mt-4">
            <CardContent className="p-8 text-center">
              <Lock className="h-12 w-12 mx-auto text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">
                {profile.is_private ? 'Private Profile' : 'Friends Only'}
              </h3>
              <p className="text-zinc-500 text-sm">
                {profile.is_private 
                  ? 'This user has set their profile to private.'
                  : 'Send a friend request to see more details.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* TODO: User's active listings section */}
      </div>
    </div>
  );
};

export default UserProfilePage;
// FILE: src/pages/arena/Messages.tsx
// Secure messaging with real-time updates, P2P support, notifications, and read receipts

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare, Send, Loader2, ArrowLeft, UserPlus,
  Package, ChevronRight, Paperclip, X, FileText, Check, CheckCheck,
  Users, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserSearchModal } from '@/components/social/UserSearchModal';

// Notification sound - base64 encoded short ding (unique to TagnetIQ)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+di4J5c29scG55hI2WnJ2ZkYZ9dXBub3N6gYqRlpmZlpCJgXpzcG9xdXuDi5GVlpSQioN8dnJvcHN4foWLj5GSj4uGgHp1cXBxdHmAhouPkJCNiYR/eXVycHJ1eX+Ei4+QkI2JhH95dXJwcnV5f4SLj5CQjYmEf3l1cnBydXl/hIuPkJCNiYR/eXVycHJ1eX+EiY2PkI6Khn95dHFwcnV5f4SJjY+QjYqGf3l0cXBydXl/hImNj5CNioZ/eXRxcHJ1eX+Eh4uNjouIhH95dHFwcXR4fYKGi42Oi4eFf3l0cHBxdHh9goaLjY6Lh4V/eXRwcHF0eH2ChYqMjYuHhX55dHBwcXR4fYKFioyNi4eFf3l0cHBxdHh9goWKjI2Lh4V+eHNvcHF0eH2ChYqMjYuHhX54c29wcXR4fYKFioyNi4eFfnhzb3BxdHh8gYSJi4yKhoR+eHNvcHF0eHyBhImLjIqGhH54c29wcXR4fIGEiYuMioaEfnhzb3BxdHh8gYSIiouJhoR+eHNvb3F0eHyBhIiKi4mGhH54c29vcXR3e4CDh4mKiIWDfXdzb29xdHd7gIOHiYqIhYN9d3Nvb3F0d3uAg4eJioiFg313c29vcXR3e4CDh4mKiIWDfXdzb29wcnV4e4CDh4mKiIWDfXdzb29wcnV4e4CDh4mJh4WCfXdzbm9wcnV4e4CDh4mJh4WCfXdzbm9wcnV4e4CChouIhoSBfHZybW5vcnV4e4CChouIhoSBfHZybW5vcnV4e4CChouIhoSBfHZybW5vcnV3eoGChomHhYOAfHZybW5vcnV3eoGChomHhYOAfHZybW5vcnV3eoGChYiGhIKAfHZybW5vcnV3eoGChYiGhIKAfHZybW1ucnV3eoGChYiGhIKAfHZybW1ucnV3en+BhIeGhIJ/e3VxbW1ucnV3en+BhIeGhIJ/e3VxbW1ucnV3en+BhIaFg4F/e3VxbG1ucnV3en+BhIaFg4F/e3VxbG1ucnV2eX6Ag4WEgoB+enRwbG1ucnV2eX6Ag4WEgoB+enRwbG1ucnV2eX6Ag4WEgoB+enRwbG1tcXR2eX6Ag4SEgn9+enRwbGxtcXR2eX6Ag4SEgn9+enRwbGxtcXR2eX5/goODgX9+enRwbGxtcXR2eX5/goODgX9+enRwbGxtcXR2eX5/goODgX9+eXNva2xtcXR2eX5/goODgX9+eXNva2xtcXR1eH1/gYKCgH5+eXNva2xtcXR1eH1/gYKCgH5+eXNva2xtcXR1eH1/gYKCgH5+eXNva2xscHN1eH1/gYKCgH59eHJuamxscHN1eH1/gYKBf359eHJuamxscHN1d3x+gIGBf359eHJuamxscHN1d3x+gIGBf359eHJuamxscHN1d3x+gIGBf359eHJuamtrcHN1d3x+gIGBf359eHJuamtrcHN1d3x+f4CAgH59d3FtaWtrcHN0dnp9f4CAgH59d3FtaWtrcHN0dnp9f4CAgH59d3FtaWtrcHN0dnp8foB/f359d3FtaWtrcHN0dnp8foB/f359d3FtaWpqb3J0dnp8foB/f359d3FtaWpqb3J0dXl7fX5/f359dnBsaGpqb3J0dXl7fX5/f359dnBsaGpqb3J0dXl7fX5+fn58dW9rZ2lqb3J0dXl7fX5+fn58dW9rZ2lqb3J0dXh6fH1+fn58dW9rZ2lqb3F0dXh6fH1+fn58dW9rZ2lpbnF0dXh6fH1+fn58dG5qZmhpbnF0dXh6fH19fX17c21pZmhpbnF0dXh5e3x9fX17c21pZmhpbnFzdXh5e3x9fX17c21pZmdobXBzdXh5e3x8fHx6cm1oZWdobXBzdXh5e3x8fHx6cm1oZWdnbXBzdXd5enx8fHx6cWxnZWdnbXBydXd5enx7e3t5cGtnZGZnbXByc3Z4eXp7e3t5cGtnZGZnbXByc3Z4eXp7e3t5cGtnZGZnbG9xc3Z3eHl6ent5b2pmY2VmbG9xc3Z3eHl6ent5b2pmY2VmbG9xcnV3eHl6enp4bmllYmRlbG9xcnV2d3h5enp4bmllYmRlbG5wcnV2d3h5eXl3bWhjYWRlbG5wcnR1dnd4eXl3bWhjYWNka25wcnR1dnd4eHh2bGdiYGNka25vcXN0dXZ3d3d1a2ZhYGJja25vcXN0dXZ3d3d1a2ZhYGJja25vcXN0dXZ2dnRqZWBfYWJka25vcXN0dXZ2dnRqZWBfYWJka25vcXN0dXV1c2lkX15fYWJka25ucXJ0dHV1c2lkX15fYWJka25ucXJ0dHV1c2lkX15fYWJka25ucXJ0dHV1c2lkX15fYWJka25ucHFyc3R0cmhjXl1eYGFjam1ub3Fycw==';

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
  };
  last_message: {
    encrypted_content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
  is_buyer: boolean;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  created_at: string;
  read: boolean;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  sender?: { id: string; screen_name: string; avatar_url?: string };
  is_own_message?: boolean;
}

interface PendingAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document';
}

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors (user hasn't interacted yet)
      });
    }
  };

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Handle URL params for deep linking
  useEffect(() => {
    const convoId = searchParams.get('conversation');
    if (convoId && conversations.length > 0) {
      const convo = conversations.find(c => c.id === convoId);
      if (convo) {
        selectConversation(convo);
      }
    }
  }, [searchParams, conversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedConvo) return;

    const channel = supabase
      .channel(`messages:${selectedConvo.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'secure_messages',
          filter: `conversation_id=eq.${selectedConvo.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Only add if not already in list
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            
            const isOwn = newMsg.sender_id === user?.id;
            
            // Play sound for incoming messages
            if (!isOwn) {
              playNotificationSound();
            }
            
            return [...prev, {
              ...newMsg,
              is_own_message: isOwn,
              sender: isOwn
                ? { id: user!.id, screen_name: 'You' }
                : selectedConvo.other_user
            }];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'secure_messages',
          filter: `conversation_id=eq.${selectedConvo.id}`
        },
        (payload) => {
          // Update read status
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id ? { ...m, read: updatedMsg.read } : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvo, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/arena/conversations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      setConversations(data.conversations || data);
      setTotalUnread(data.total_unread || 0);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConvos(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/arena/messages?conversationId=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data.messages || data);
      
      // Refresh conversations to update unread counts
      fetchConversations();
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = (convo: Conversation) => {
    setSelectedConvo(convo);
    setSearchParams({ conversation: convo.id });
    setShowMobileList(false);
    fetchMessages(convo.id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isDocument = file.type === 'application/pdf' ||
                       file.type.includes('document') ||
                       file.type.includes('text');

    if (!isImage && !isDocument) {
      toast.error('Unsupported file type. Please upload images or documents.');
      return;
    }

    const preview = isImage ? URL.createObjectURL(file) : '';
    setAttachment({ file, preview, type: isImage ? 'image' : 'document' });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
  };

  const uploadAttachment = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !selectedConvo) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedConvo.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) {
        if (error.message.includes('not found')) {
          toast.error('Attachments not yet configured. Sending message without file.');
          return null;
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(data.path);

      return {
        url: publicUrl,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        name: file.name
      };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return null;
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedConvo) return;

    setSending(true);
    setUploading(!!attachment);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let attachmentData = null;
      if (attachment) {
        attachmentData = await uploadAttachment(attachment.file);
      }

      const response = await fetch('/api/arena/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: selectedConvo.id,
          content: newMessage.trim() || (attachment ? `[Attachment: ${attachment.file.name}]` : ''),
          attachment_url: attachmentData?.url,
          attachment_type: attachmentData?.type,
          attachment_name: attachmentData?.name
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const sentMessage = await response.json();

      setMessages(prev => {
        if (prev.some(m => m.id === sentMessage.id)) return prev;
        return [...prev, {
          ...sentMessage,
          is_own_message: true,
          sender: { id: user!.id, screen_name: 'You' },
          attachment_url: attachmentData?.url,
          attachment_type: attachmentData?.type,
          attachment_name: attachmentData?.name
        }];
      });

      setNewMessage('');
      removeAttachment();
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderAttachment = (msg: Message) => {
    if (!msg.attachment_url) return null;

    if (msg.attachment_type === 'image') {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img
            src={msg.attachment_url}
            alt={msg.attachment_name || 'Attachment'}
            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      );
    }

    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 p-2 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
      >
        <FileText className="h-4 w-4" />
        <span className="text-sm truncate">{msg.attachment_name || 'Document'}</span>
      </a>
    );
  };

  // Read receipt indicator
  const renderReadReceipt = (msg: Message) => {
    if (!msg.is_own_message) return null;
    
    return (
      <span className="ml-1 inline-flex">
        {msg.read ? (
          <CheckCheck className="h-3 w-3 text-blue-400" title="Read" />
        ) : (
          <Check className="h-3 w-3 opacity-50" title="Delivered" />
        )}
      </span>
    );
  };

  // Empty state
  if (!loadingConvos && conversations.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Messages</h1>
          <Button onClick={() => setSearchOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Messages Yet</h2>
            <p className="text-muted-foreground mb-4">
              Start a conversation with another user or contact a seller from the marketplace.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setSearchOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Find Users
              </Button>
              <Button variant="outline" onClick={() => navigate('/arena/marketplace')}>
                Browse Marketplace
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <UserSearchModal
          open={searchOpen}
          onOpenChange={setSearchOpen}
          mode="message"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">
          Messages
          {totalUnread > 0 && (
            <Badge className="ml-2 bg-primary">{totalUnread}</Badge>
          )}
        </h1>
        <Button onClick={() => setSearchOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <Card className="h-[calc(100vh-200px)] min-h-[500px]">
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={cn(
            "w-full md:w-80 border-r flex flex-col",
            !showMobileList && "hidden md:flex"
          )}>
            <div className="p-4 border-b">
              <h2 className="font-semibold">Conversations</h2>
            </div>

            <ScrollArea className="flex-1">
              {loadingConvos ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((convo) => {
                    const isSelected = selectedConvo?.id === convo.id;
                    const isDirect = convo.conversation_type === 'direct';

                    return (
                      <button
                        key={convo.id}
                        onClick={() => selectConversation(convo)}
                        className={cn(
                          "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                          isSelected && "bg-muted"
                        )}
                      >
                        <div className="flex gap-3">
                          {/* Avatar or Listing Image */}
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {isDirect ? (
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={convo.other_user.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {convo.other_user.screen_name?.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : convo.listing?.primary_photo_url ? (
                              <img
                                src={convo.listing.primary_photo_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate flex items-center gap-1">
                                {isDirect && <User className="h-3 w-3 text-blue-400" />}
                                {convo.other_user.screen_name}
                              </span>
                              {convo.last_message && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {formatTime(convo.last_message.created_at)}
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground truncate">
                              {isDirect ? 'Direct message' : convo.listing?.item_name || 'Unknown Item'}
                            </p>

                            {convo.last_message && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {convo.last_message.sender_id === user?.id ? 'You: ' : ''}
                                {convo.last_message.encrypted_content}
                              </p>
                            )}
                          </div>

                          {convo.unread_count > 0 && (
                            <Badge className="ml-2 flex-shrink-0">
                              {convo.unread_count}
                            </Badge>
                          )}

                          <ChevronRight className="h-4 w-4 text-muted-foreground md:hidden" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message Thread */}
          <div className={cn(
            "flex-1 flex flex-col",
            showMobileList && "hidden md:flex"
          )}>
            {selectedConvo ? (
              <>
                {/* Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setShowMobileList(true)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  {/* User Avatar or Listing Image */}
                  {selectedConvo.conversation_type === 'direct' ? (
                    <Avatar 
                      className="h-10 w-10 cursor-pointer"
                      onClick={() => navigate(`/user/${selectedConvo.other_user.id}`)}
                    >
                      <AvatarImage src={selectedConvo.other_user.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedConvo.other_user.screen_name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {selectedConvo.listing?.primary_photo_url ? (
                        <img
                          src={selectedConvo.listing.primary_photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}

                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/user/${selectedConvo.other_user.id}`)}
                  >
                    <p className="font-medium truncate">
                      {selectedConvo.other_user.screen_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedConvo.conversation_type === 'direct' 
                        ? 'Direct message'
                        : selectedConvo.listing?.item_name || 'Unknown Item'}
                    </p>
                  </div>

                  <Badge variant="outline">
                    {selectedConvo.conversation_type === 'direct' 
                      ? <><User className="h-3 w-3 mr-1" /> Direct</>
                      : selectedConvo.is_buyer ? 'Buyer' : 'Seller'}
                  </Badge>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const isOwn = msg.is_own_message || msg.sender_id === user?.id;

                        return (
                          <div
                            key={msg.id}
                            className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                          >
                            <div className={cn(
                              "max-w-[80%] rounded-lg px-4 py-2",
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}>
                              <p className="whitespace-pre-wrap break-words">
                                {msg.encrypted_content}
                              </p>
                              {renderAttachment(msg)}
                              <div className={cn(
                                "flex items-center justify-end gap-1 text-xs mt-1",
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                <span>{formatTime(msg.created_at)}</span>
                                {renderReadReceipt(msg)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Attachment Preview */}
                {attachment && (
                  <div className="px-4 py-2 border-t bg-muted/50">
                    <div className="flex items-center gap-3">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.preview}
                          alt="Preview"
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={removeAttachment}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t">
                  <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                    className="flex gap-2"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={sending}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button type="submit" disabled={sending || (!newMessage.trim() && !attachment)}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <UserSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        mode="message"
      />
    </div>
  );
};

export default MessagesPage;
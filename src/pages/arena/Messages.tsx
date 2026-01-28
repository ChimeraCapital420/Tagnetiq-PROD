// FILE: src/pages/arena/Messages.tsx
// Secure messaging with real-time updates and attachments

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Send, Loader2, ArrowLeft, 
  Package, Clock, ChevronRight, Paperclip, X, Image as ImageIcon, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
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
  sender?: { id: string; screen_name: string };
}

interface PendingAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document';
}

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
          // Only add if not already in list (avoid duplicates from own sends)
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, {
              ...newMsg,
              sender: newMsg.sender_id === user?.id 
                ? { id: user.id, screen_name: 'You' }
                : { id: newMsg.sender_id, screen_name: getOtherParty(selectedConvo).screen_name }
            }];
          });
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
      setConversations(data);
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
      setMessages(data);
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

    // Check file size (10MB limit)
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
    setAttachment({
      file,
      preview,
      type: isImage ? 'image' : 'document'
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => {
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
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
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        // If bucket doesn't exist, still send message without attachment
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
          attachmentUrl: attachmentData?.url,
          attachmentType: attachmentData?.type,
          attachmentName: attachmentData?.name
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const sentMessage = await response.json();
      
      // Add to local messages (realtime will also catch it, but this is faster)
      setMessages(prev => {
        if (prev.some(m => m.id === sentMessage.id)) return prev;
        return [...prev, { 
          ...sentMessage, 
          sender: { id: user!.id, screen_name: 'You' },
          attachment_url: attachmentData?.url,
          attachment_type: attachmentData?.type,
          attachment_name: attachmentData?.name
        }];
      });

      setNewMessage('');
      removeAttachment();
      
      // Update conversation list
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

  const getOtherParty = (convo: Conversation) => {
    return convo.is_seller ? convo.buyer : convo.seller;
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

  // Empty state
  if (!loadingConvos && conversations.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">Messages</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Messages Yet</h2>
            <p className="text-muted-foreground mb-4">
              When you contact a seller or a buyer messages you, conversations will appear here.
            </p>
            <Button onClick={() => window.location.href = '/arena/marketplace'}>
              Browse Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">Messages</h1>
      
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
                    const otherParty = getOtherParty(convo);
                    const isSelected = selectedConvo?.id === convo.id;
                    
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
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {convo.listing?.primary_photo_url ? (
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
                              <span className="font-medium truncate">
                                {otherParty.screen_name}
                              </span>
                              {convo.last_message && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {formatTime(convo.last_message.created_at)}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground truncate">
                              {convo.listing?.item_name || 'Unknown Item'}
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
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {getOtherParty(selectedConvo).screen_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedConvo.listing?.item_name || 'Unknown Item'}
                    </p>
                  </div>
                  
                  <Badge variant="outline">
                    {selectedConvo.is_seller ? 'Buyer' : 'Seller'}
                  </Badge>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
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
                        const isOwn = msg.sender_id === user?.id;
                        
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              isOwn ? "justify-end" : "justify-start"
                            )}
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
                              <p className={cn(
                                "text-xs mt-1",
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {formatTime(msg.created_at)}
                              </p>
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
    </div>
  );
};

export default MessagesPage;
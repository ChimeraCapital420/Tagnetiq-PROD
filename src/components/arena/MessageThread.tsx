// FILE: src/components/arena/MessageThread.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, DollarSign, Ban, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MessageActions } from '@/components/messaging/MessageActions';
import { MessageAttachment } from '@/components/messaging/MessageAttachment';

interface Message {
  id: string;
  encrypted_content: string;
  sender_id: string;
  sender: { screen_name: string };
  attachment_url?: string | null;
  is_deleted?: boolean;
  created_at?: string;
}

interface MessageThreadProps {
  conversationId: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ conversationId }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('secure_messages')
        .select('id, encrypted_content, sender_id, attachment_url, is_deleted, created_at, sender:profiles(id, screen_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error("Failed to load messages", { description: error.message });
      } else {
        setMessages(data as any);
      }
    };
    fetchMessages();

    // Real-time subscription for new messages and updates
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secure_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the full message with sender info
            fetchMessages();
          } else if (payload.eventType === 'UPDATE') {
            // Update the message in state (for deletions)
            setMessages(prev => prev.map(m => 
              m.id === payload.new.id 
                ? { ...m, ...payload.new }
                : m
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Long press handlers for mobile
  const handleTouchStart = useCallback((messageId: string) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedMessageId(messageId);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Context menu for desktop
  const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setSelectedMessageId(messageId);
  }, []);

  // Delete message handler
  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/arena/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deleteForEveryone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete message');
      }

      // Update local state immediately
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, is_deleted: true, encrypted_content: '', attachment_url: null }
          : m
      ));

      toast.success('Message deleted');
      setSelectedMessageId(null);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast.error(message);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large', { description: 'Max size is 10MB' });
        return;
      }
      setAttachment(file);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send message with optional attachment
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;

    const tempMessageId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempMessageId,
      encrypted_content: newMessage,
      sender_id: user!.id,
      sender: { screen_name: profile?.screen_name || 'Me' },
      attachment_url: attachment ? URL.createObjectURL(attachment) : null,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    const messageText = newMessage;
    const messageAttachment = attachment;
    setNewMessage('');
    setAttachment(null);

    try {
      let attachmentUrl: string | null = null;

      // Upload attachment if exists
      if (messageAttachment) {
        setIsUploading(true);
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 12);
        const ext = messageAttachment.name.split('.').pop() || 'bin';
        const filePath = `${conversationId}/${timestamp}-${randomStr}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, messageAttachment);

        if (uploadError) {
          throw new Error('Failed to upload attachment');
        }

        attachmentUrl = filePath;
        setIsUploading(false);
      }

      // Insert message via API
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/arena/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          content: messageText,
          attachment_url: attachmentUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Remove optimistic message (real one will come via subscription)
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));

    } catch (error) {
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      setIsUploading(false);
    }
  };

  // Get selected message for actions sheet
  const selectedMessage = messages.find(m => m.id === selectedMessageId);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map(msg => {
            const isSender = msg.sender_id === user?.id;

            // Render deleted message indicator
            if (msg.is_deleted) {
              return (
                <div 
                  key={msg.id} 
                  className={cn("flex mb-2", isSender ? "justify-end" : "justify-start")}
                >
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-2xl max-w-[80%]",
                      "bg-gray-100 dark:bg-gray-800",
                      isSender ? "rounded-br-md" : "rounded-bl-md"
                    )}
                  >
                    <Ban className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm italic text-gray-500 dark:text-gray-400">
                      {isSender ? 'You deleted this message' : 'This message was deleted'}
                    </span>
                  </div>
                </div>
              );
            }

            // Render normal message
            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex items-end gap-2", 
                  isSender ? "justify-end" : "justify-start"
                )}
                onTouchStart={() => handleTouchStart(msg.id)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={(e) => handleContextMenu(e, msg.id)}
              >
                {!isSender && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${msg.sender.screen_name}`} />
                    <AvatarFallback>{msg.sender.screen_name?.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                )}
                <div 
                  className={cn(
                    "max-w-xs rounded-lg overflow-hidden",
                    isSender 
                      ? "bg-primary text-primary-foreground rounded-br-sm" 
                      : "bg-muted rounded-bl-sm"
                  )}
                >
                  {/* Attachment */}
                  {msg.attachment_url && (
                    <MessageAttachment 
                      url={msg.attachment_url} 
                      conversationId={conversationId}
                    />
                  )}
                  {/* Text content */}
                  {msg.encrypted_content && (
                    <p className="px-4 py-2">
                      {msg.encrypted_content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Message input area */}
      <div className="p-4 border-t">
        <div className="p-2 mb-2 border rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <DollarSign size={14}/> Payment Shortcuts & Disclaimer
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tagnetiq facilitates discovery, not transactions. All payments must be handled externally.
          </p>
        </div>

        {/* Attachment preview */}
        {attachment && (
          <div className="flex items-center gap-2 p-2 mb-2 bg-muted rounded-lg">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm truncate flex-1">{attachment.name}</span>
            <button 
              onClick={removeAttachment}
              className="p-1 hover:bg-background rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            type="button" 
            size="icon" 
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder="Type your message..." 
            autoComplete="off"
            disabled={isUploading}
          />
          <Button type="submit" size="icon" disabled={isUploading || (!newMessage.trim() && !attachment)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Message Actions Bottom Sheet */}
      {selectedMessageId && selectedMessage && !selectedMessage.is_deleted && (
        <MessageActions
          messageId={selectedMessageId}
          senderId={selectedMessage.sender_id}
          isDeleted={selectedMessage.is_deleted || false}
          onDelete={handleDeleteMessage}
          onClose={() => setSelectedMessageId(null)}
        />
      )}
    </div>
  );
};
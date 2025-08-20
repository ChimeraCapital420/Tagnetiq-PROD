// FILE: src/components/arena/MessageThread.tsx

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: number;
  encrypted_content: string;
  sender_id: string;
  sender: { screen_name: string };
}

interface MessageThreadProps {
  conversationId: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ conversationId }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('secure_messages')
        .select('*, sender:profiles(id, screen_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error("Failed to load messages", { description: error.message });
      } else {
        setMessages(data as any);
      }
    };
    fetchMessages();
  }, [conversationId]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      const tempMessageId = Date.now();
      const optimisticMessage: Message = {
          id: tempMessageId,
          encrypted_content: newMessage,
          sender_id: user!.id,
          sender: { screen_name: profile?.screen_name || 'Me' }
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');

      const { error } = await supabase.from('secure_messages').insert({
          conversation_id: conversationId,
          sender_id: user!.id,
          encrypted_content: optimisticMessage.encrypted_content,
      });

      if (error) {
          toast.error("Failed to send message");
          setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      }
  };


  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
            {messages.map(msg => (
                <div key={msg.id} className={cn("flex items-end gap-2", msg.sender_id === user?.id ? "justify-end" : "justify-start")}>
                    {msg.sender_id !== user?.id && <Avatar className="h-8 w-8"><AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${msg.sender.screen_name}`} /><AvatarFallback>{msg.sender.screen_name?.substring(0, 2)}</AvatarFallback></Avatar>}
                    <p className={cn("max-w-xs rounded-lg px-4 py-2", msg.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {msg.encrypted_content}
                    </p>
                </div>
            ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <div className="p-2 mb-2 border rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2"><DollarSign size={14}/> Payment Shortcuts & Disclaimer</p>
            <p className="text-xs text-muted-foreground mt-1">
                Tagnetiq facilitates discovery, not transactions. All payments must be handled externally. Agree on a method and be cautious.
            </p>
        </div>
        <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." autoComplete="off" />
            <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
};
// FILE: src/pages/arena/Messages.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { ConversationList } from '@/components/arena/ConversationList';
import { MessageThread } from '@/components/arena/MessageThread';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  listing: { item_name: string };
  buyer: { id: string; screen_name: string };
  seller: { id: string; screen_name: string };
}

const MessagesPage: React.FC = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchConversations = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch('/api/arena/conversations', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            if (!response.ok) throw new Error('Failed to fetch conversations.');
            
            const data = await response.json();
            setConversations(data);
            if (data.length > 0 && !selectedConvoId) {
                setSelectedConvoId(data[0].id);
            }
        } catch (error) {
            toast.error("Error", { description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [selectedConvoId]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    if (loading) {
        return <div className="container p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-4">My Messages</h1>
            <Card className="h-[calc(100vh-12rem)]">
                <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                    <div className="md:col-span-1 border-r h-full overflow-y-auto p-4">
                        <ConversationList
                            conversations={conversations}
                            selectedConversationId={selectedConvoId}
                            onSelectConversation={setSelectedConvoId}
                            currentUserId={user!.id}
                        />
                    </div>
                    <div className="md:col-span-2 h-full">
                        {selectedConvoId ? (
                            <MessageThread conversationId={selectedConvoId} />
                        ) : (
                            <div className="flex flex-col h-full items-center justify-center text-center">
                                <MessageCircle className="h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
                                <p className="text-muted-foreground">Choose a conversation from the left to view messages.</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default MessagesPage;
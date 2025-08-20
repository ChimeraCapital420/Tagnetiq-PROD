// FILE: src/components/arena/WatchlistManager.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Watchlist {
  id: string;
  keywords: string[];
}

export const WatchlistManager: React.FC = () => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [newKeywords, setNewKeywords] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWatchlists = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/arena/watchlist', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch watchlists.');
      const data = await response.json();
      setWatchlists(data);
    } catch (error) {
      toast.error("Could not load watchlist", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = newKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch('/api/arena/watchlist', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ keywords }),
        });
        if (!response.ok) throw new Error('Failed to add watchlist.');
        
        toast.success("Watchlist item added!");
        setNewKeywords('');
        fetchWatchlists(); // Refresh list
    } catch (error) {
        toast.error("Failed to add item", { description: (error as Error).message });
    }
  };
  
  const handleRemove = async (id: string) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        await fetch('/api/arena/watchlist', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id }),
        });
        toast.success("Watchlist item removed.");
        fetchWatchlists(); // Refresh list
    } catch (error) {
         toast.error("Failed to remove item", { description: (error as Error).message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Watchlist</CardTitle>
        <CardDescription>Get alerts for new listings with matching keywords.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <Input 
            placeholder="Add keywords, comma-separated"
            value={newKeywords}
            onChange={(e) => setNewKeywords(e.target.value)}
          />
          <Button type="submit">Add</Button>
        </form>
        {loading ? <Loader2 className="animate-spin" /> : (
          <div className="space-y-2">
            {watchlists.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-md">
                <div className="flex flex-wrap gap-1">
                    {item.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemove(item.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
             {watchlists.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Your watchlist is empty.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
// FILE: src/components/investor/InvestorInviteModule.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '../ui/separator';
import { Loader2, Send, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface InviteStats {
  totalSent: number;
  totalAccepted: number;
  totalInvested: number;
  conversionRate: number;
}

interface Invite {
  id: string;
  invitee_email: string;
  status: 'sent' | 'accepted' | 'invested';
  created_at: string;
}

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: string | number; }> = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg text-center">
        <Icon className="w-6 h-6 mb-2 text-muted-foreground" />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
    </div>
);

export const InvestorInviteModule: React.FC = () => {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isFetchingStats, setIsFetchingStats] = useState(true);

  const fetchStats = async () => {
    if (!session) return;
    setIsFetchingStats(true);
    try {
        const response = await fetch('/api/investor/invite-stats', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch stats.');
        const data = await response.json();
        setStats(data.stats);
        setInvites(data.invites);
    } catch (error) {
        toast.error('Could not load your referral stats.');
    } finally {
        setIsFetchingStats(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, [session]);

  const handleInvite = async () => {
    if (!email) {
      toast.error('Please enter an email address.');
      return;
    }
    if (!session) {
      toast.error('Authentication error.');
      return;
    }
    setIsLoading(true);

    // --- SURGICAL FIX START ---
    // The logic inside this try...catch block is the only part that has been modified.
    try {
      const response = await fetch('/api/investor/invite', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        // This ensures that if the API returns an error in the JSON, it is properly thrown.
        throw new Error(result.error || 'Failed to send invite.');
      }
      
      toast.success('Invite Sent!', { description: `An invitation has been sent to ${email}.` });
      setEmail('');
      fetchStats(); // This correctly refreshes the stats after a successful invite.
    } catch (error) {
      toast.error('Invite Failed', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
    // --- SURGICAL FIX END ---
  };

  const statusBadge = (status: Invite['status']) => {
    switch(status) {
        case 'sent': return <Badge variant="secondary">Sent</Badge>;
        case 'accepted': return <Badge variant="outline" className="text-blue-500 border-blue-500">Accepted</Badge>;
        case 'invested': return <Badge className="bg-green-500 hover:bg-green-600">Invested</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grow the Network</CardTitle>
        <CardDescription>Invite trusted colleagues to explore this opportunity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="investor-email">Recipient's Email</Label>
            <div className="flex gap-2">
                <Input 
                    id="investor-email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="name@company.com"
                    disabled={isLoading}
                />
                <Button onClick={handleInvite} disabled={isLoading} size="icon" aria-label="Send Invite">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4"/>}
                </Button>
            </div>
        </div>
      </CardContent>
      <Separator />
      <CardHeader>
        <CardTitle className="text-lg">Your Referral Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        {isFetchingStats ? <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin text-muted-foreground"/></div> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Send} label="Invites Sent" value={stats?.totalSent ?? 0} />
            <StatCard icon={Users} label="Accepted" value={stats?.totalAccepted ?? 0} />
            <StatCard icon={CheckCircle} label="Invested" value={stats?.totalInvested ?? 0} />
            <StatCard icon={TrendingUp} label="Conversion" value={`${stats?.conversionRate ?? 0}%`} />
          </div>  
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <h4 className="font-medium text-sm mb-2">Invite History</h4>
        <div className="w-full border rounded-md max-h-60 overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invites.length > 0 ? invites.map(invite => (
                        <TableRow key={invite.id}>
                            <TableCell className="font-medium">{invite.invitee_email}</TableCell>
                            <TableCell className="text-right">{statusBadge(invite.status)}</TableCell>
                        </TableRow>
                    )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No invites sent yet.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </div>
      </CardFooter>
    </Card>
  );
};
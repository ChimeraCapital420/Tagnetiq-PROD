import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export const ReferralCard: React.FC = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralUrl, setReferralUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ sent: 0, joined: 0, activated: 0 });

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('beta_testers')
        .select('referral_code')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching referral code', error);
        return;
      }
      
      const code = data?.referral_code || 'GENERATING...';
      setReferralCode(code);
      setReferralUrl(`${window.location.origin}/signup?ref=${code}`);
      
      // In a real app, you would fetch the referral stats from the 'referrals' table
      setStats({ sent: 5, joined: 2, activated: 1 });
    };

    fetchReferralData();
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Fellow Testers</CardTitle>
        <CardDescription>Share your unique link to invite others to the beta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="referral-link" className="text-sm font-medium">Your Unique Referral Link</label>
          <div className="flex gap-2">
            <Input id="referral-link" readOnly value={referralUrl} />
            <Button size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
            <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Invites Sent</p>
            </div>
            <div>
                <p className="text-2xl font-bold">{stats.joined}</p>
                <p className="text-xs text-muted-foreground">Joined</p>
            </div>
            <div>
                <p className="text-2xl font-bold">{stats.activated}</p>
                <p className="text-xs text-muted-foreground">Activated</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};
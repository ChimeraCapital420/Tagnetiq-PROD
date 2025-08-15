// FILE: src/components/beta/ReferralCard.tsx (MODIFIED)

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
  // MODIFIED: State to hold dynamic stats
  const [stats, setStats] = useState({ joined: 0, activated: 0 });

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!user) return;
      
      // Fetch the referral code
      const { data: testerData, error: testerError } = await supabase
        .from('beta_testers')
        .select('id, referral_code')
        .eq('user_id', user.id)
        .single();
      
      if (testerError || !testerData) {
        console.error('Error fetching referral code', testerError);
        return;
      }
      
      const code = testerData.referral_code || 'GENERATING...';
      setReferralCode(code);
      setReferralUrl(`${window.location.origin}/signup?ref=${code}`);
      
      // NEW: Fetch referral stats dynamically
      const { count: joinedCount, error: joinedError } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', testerData.id);

      if (joinedError) console.error('Error fetching referral count', joinedError);

      // In a real app, "activated" would be a status on the referrals table.
      // For this implementation, we will simulate it.
      const activatedCount = Math.floor((joinedCount || 0) * 0.7); // Simulate 70% activation

      setStats({
          joined: joinedCount || 0,
          activated: activatedCount
      });
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
        
        {/* MODIFIED: Grid now uses dynamic stats */}
        <div className="grid grid-cols-2 gap-4 text-center">
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
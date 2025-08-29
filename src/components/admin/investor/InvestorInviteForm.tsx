// FILE: src/components/admin/investor/InvestorInviteForm.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const InvestorInviteForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = async () => {
    if (!email) {
      toast.error('Please enter the investor\'s email address.');
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch('/api/investor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send invite.');
      }
      
      toast.success('Invite Sent Successfully!', {
        description: `An invitation has been emailed to ${email}.`,
      });

      // Reset form
      setEmail('');
    } catch (error) {
      toast.error('Invite Failed', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite New Investor</CardTitle>
        <CardDescription>Send a secure invitation link directly to a potential investor's email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="investor-email">Investor Email</Label>
            <Input 
                id="investor-email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="jane.doe@example.com"
                disabled={isLoading}
            />
        </div>
        <Button onClick={handleInvite} disabled={isLoading} className="w-full">
            {isLoading ? 'Sending Invite...' : 'Send Secure Invitation'}
        </Button>
      </CardContent>
    </Card>
  );
};
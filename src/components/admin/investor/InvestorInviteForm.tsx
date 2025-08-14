import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const InvestorInviteForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = async () => {
    if (!email || !name) {
      toast.error('Please enter the investor\'s name and email.');
      return;
    }
    setIsLoading(true);

    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

    try {
      const response = await fetch('/api/investors/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, expires_at, mode }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send invite.');
      }
      
      const { signedUrl } = await response.json();
      toast.success('Investor Invite Sent!', {
        description: `A unique, tracked link has been generated for ${name}.`,
        action: {
          label: 'Copy Link',
          onClick: () => navigator.clipboard.writeText(signedUrl),
        },
      });
      // Reset form
      setName('');
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
        <CardDescription>Generate a secure, tracked link for a potential investor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="investor-name">Name</Label>
            <Input id="investor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="investor-email">Email</Label>
            <Input id="investor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@example.com" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Portal Mode</Label>
          <Select onValueChange={(value: 'demo' | 'live') => setMode(value)} defaultValue="demo">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="demo">Demo Data</SelectItem>
              <SelectItem value="live">Live Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInvite} disabled={isLoading} className="w-full">
          {isLoading ? 'Generating Link...' : 'Generate Secure Invite Link'}
        </Button>
      </CardContent>
    </Card>
  );
};
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get session token

export const AdminInviteForm: React.FC = () => {
  const { session } = useAuth(); // Get session for authenticated API calls
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = async () => {
    if (!email) {
      toast.error('Please enter an email address to send an invite.');
      return;
    }
    if (!session) {
      toast.error('Authentication error. Please log in again.');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/beta/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add the Authorization header for secure endpoints
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send invite.');
      }

      // CORRECTED: The success message now accurately reflects the backend action.
      // No misleading "Copy Link" action is provided.
      toast.success('Invite Sent Successfully!', {
        description: `An invitation email has been sent to ${email}.`,
      });
      setEmail(''); // Clear input on success
    } catch (error) {
      toast.error('Failed to send invite', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a New Beta Tester</CardTitle>
        <CardDescription>Enter the email of the person you want to invite to the beta program.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <div className="w-full space-y-2">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input 
                id="invite-email"
                type="email"
                placeholder="new.tester@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
            />
        </div>
        <Button onClick={handleInvite} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Invite'}
        </Button>
      </CardContent>
    </Card>
  );
};

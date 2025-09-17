// FILE: src/components/admin/UnifiedInviteForm.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface UnifiedInviteFormProps {
  role: 'investor' | 'beta';
  onSuccess?: () => void;
}

export const UnifiedInviteForm: React.FC<UnifiedInviteFormProps> = ({ role, onSuccess }) => {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic configuration based on role
  const config = {
    investor: {
      title: 'Invite New Investor',
      description: 'Send a secure invitation link directly to a potential investor\'s email.',
      placeholder: 'jane.doe@example.com',
      buttonText: 'Send Secure Invitation',
      endpoint: '/api/investor/invite',
      successMessage: 'Investor invitation sent',
      labelId: 'investor-email',
      labelText: 'Investor Email'
    },
    beta: {
      title: 'Invite a New Beta Tester',
      description: 'Enter the email of the person you want to invite to the beta program.',
      placeholder: 'new.tester@example.com',
      buttonText: 'Send Invite',
      endpoint: '/api/beta/invite',
      successMessage: 'Beta invitation sent',
      labelId: 'beta-email',
      labelText: 'Email'
    }
  }[role];

  const handleInvite = async () => {
    if (!email) {
      toast.error(`Please enter an email address to send ${role === 'investor' ? 'an investor' : 'a beta'} invite.`);
      return;
    }

    // Only check for session if it's a beta invite (based on original code)
    if (role === 'beta' && !session) {
      toast.error('Authentication error. Please log in again.');
      return;
    }

    setIsLoading(true);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      // Add auth header for beta invites
      if (role === 'beta' && session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send invite.');
      }
      
      toast.success(`${config.successMessage}!`, {
        description: `An invitation has been emailed to ${email}.`,
      });

      // Reset form
      setEmail('');
      
      // Call optional success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error('Invite Failed', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={config.labelId}>{config.labelText}</Label>
          <Input 
            id={config.labelId}
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder={config.placeholder}
            disabled={isLoading}
          />
        </div>
        <Button onClick={handleInvite} disabled={isLoading} className="w-full">
          {isLoading ? 'Sending...' : config.buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};
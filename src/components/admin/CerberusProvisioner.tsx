// src/components/admin/CerberusProvisioner.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Bot, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const CerberusProvisioner: React.FC = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);

  const handleProvision = async () => {
    if (!session) {
      toast.error('You must be logged in as an admin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/cerberus/provision-agent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to provision agent');
      }

      setCredentials(data.credentials);
      toast.success('AI Test Agent created successfully!');
      
      // Also save to localStorage for testing
      localStorage.setItem('cerberus-credentials', JSON.stringify(data.credentials));
      
    } catch (error) {
      toast.error('Failed to provision agent', {
        description: (error as Error).message
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Cerberus AI Agent Provisioner
        </CardTitle>
        <CardDescription>
          Create an AI test agent that can automatically test the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!credentials ? (
          <Button 
            onClick={handleProvision} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating AI Agent...' : 'Create AI Test Agent'}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs">{credentials.email}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(credentials.email)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Password:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs">{credentials.password}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(credentials.password)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">User ID:</span>
                <code className="text-xs">{credentials.userId}</code>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              These credentials have been saved to your browser's localStorage for testing.
              They will be available until you clear your browser data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
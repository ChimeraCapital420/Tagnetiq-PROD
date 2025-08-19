// FILE: src/pages/admin/ApiHealthCheck.tsx (REVISED AND CONSOLIDATED)

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader, Server } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get the token

type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

interface ApiCheck {
  name: string;
  service: string; // A key to identify the service in the backend
}

const apiChecks: ApiCheck[] = [
  { name: 'OpenAI (GPT-4)', service: 'openai' },
  { name: 'Anthropic (Claude)', service: 'anthropic' },
  { name: 'Google (Gemini)', service: 'google' },
  // Add other checks for DeepSeek, Grok, etc. as needed
];

const ApiHealthCheck: React.FC = () => {
  const { session } = useAuth(); // Get the session for the auth token
  const [statuses, setStatuses] = useState<Record<string, ApiStatus>>(
    apiChecks.reduce((acc, check) => ({ ...acc, [check.name]: 'idle' }), {})
  );

  const handleCheck = async (api: ApiCheck) => {
    if (!session) {
        toast.error("Authentication Error", { description: "You must be logged in to perform health checks." });
        return;
    }
    
    setStatuses(prev => ({ ...prev, [api.name]: 'loading' }));
    toast.info(`Pinging ${api.name}...`);

    try {
      const response = await fetch(`/api/admin/health-check?service=${api.service}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Health check failed with a non-200 status.');
      }
      
      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'API reported an issue.');
      }

      setStatuses(prev => ({ ...prev, [api.name]: 'success' }));
      toast.success(`${api.name} connection is healthy.`);

    } catch (error) {
      setStatuses(prev => ({ ...prev, [api.name]: 'error' }));
      toast.error(`Health check for ${api.name} failed.`, {
        description: (error as Error).message,
      });
    }
  };

  const renderStatusIcon = (status: ApiStatus) => {
    switch (status) {
      case 'loading':
        return <Loader className="h-5 w-5 animate-spin text-muted-foreground" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Server className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>API Health Check</CardTitle>
          <CardDescription>
            Verify the status of connections to the Hydra Engine's integrated AI services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiChecks.map(api => (
            <div
              key={api.name}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                {renderStatusIcon(statuses[api.name])}
                <span className="font-medium">{api.name}</span>
              </div>
              <Button
                variant="outline"
                onClick={() => handleCheck(api)}
                disabled={statuses[api.name] === 'loading'}
              >
                Run Check
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiHealthCheck;
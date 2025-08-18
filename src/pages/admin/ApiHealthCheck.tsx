// FILE: src/pages/admin/ApiHealthCheck.tsx (CREATE THIS NEW FILE)

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader, Server } from 'lucide-react';

type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

interface ApiCheck {
  name: string;
  endpoint: string;
}

const apiChecks: ApiCheck[] = [
    // This is a placeholder. We will create this API endpoint later.
  { name: 'Anthropic (Claude)', endpoint: '/api/health/anthropic' }, 
  // Add other API health checks here as we build them.
];

const ApiHealthCheck: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, ApiStatus>>(
    apiChecks.reduce((acc, check) => ({ ...acc, [check.name]: 'idle' }), {})
  );

  const handleCheck = async (api: ApiCheck) => {
    setStatuses(prev => ({ ...prev, [api.name]: 'loading' }));
    
    // NOTE: This will fail until we create the backend API endpoint.
    // This is expected for now.
    toast.info(`Pinging ${api.name}...`, { description: "This will fail until the health endpoint is built."});

    try {
      const response = await fetch(api.endpoint);
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Health check failed.');
      }
      const result = await response.json();
      if (!result.success) {
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
           <p className="text-xs text-muted-foreground pt-4">
            Note: The check buttons will show an error until the corresponding backend health endpoints are created during the Hydra Engine SDK upgrade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiHealthCheck;
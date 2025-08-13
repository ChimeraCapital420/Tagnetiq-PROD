import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Link, CheckCircle, XCircle, Key, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ApiConnections: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const { toast } = useToast();
  const themeConfig = getThemeConfig(theme, themeMode);
  
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.archersmarkcapital.com');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setIsConnected(true);
        toast({
          title: "Connection Successful",
          description: "API connection established successfully.",
          duration: 3000,
        });
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setIsConnected(false);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to the API. Please check your settings.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card 
      className="backdrop-blur-sm border mb-6"
      style={{
        backgroundColor: `${themeConfig.colors.surface}90`,
        borderColor: `${themeConfig.colors.border}50`,
        color: themeConfig.colors.text
      }}
    >
      <CardHeader>
        <CardTitle 
          className="flex items-center text-2xl"
          style={{ 
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.heading
          }}
        >
          <Server className="w-6 h-6 mr-3" />
          API Connections
        </CardTitle>
        <p 
          className="text-lg"
          style={{ color: themeConfig.colors.textSecondary }}
        >
          Configure your API settings for product analysis
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label 
              htmlFor="apiEndpoint"
              style={{ color: themeConfig.colors.text }}
            >
              API Endpoint
            </Label>
            <Input
              id="apiEndpoint"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.archersmarkcapital.com"
              style={{
                backgroundColor: `${themeConfig.colors.background}50`,
                borderColor: `${themeConfig.colors.border}30`,
                color: themeConfig.colors.text
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label 
              htmlFor="apiKey"
              style={{ color: themeConfig.colors.text }}
            >
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              style={{
                backgroundColor: `${themeConfig.colors.background}50`,
                borderColor: `${themeConfig.colors.border}30`,
                color: themeConfig.colors.text
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border"
          style={{
            backgroundColor: `${themeConfig.colors.background}50`,
            borderColor: `${themeConfig.colors.border}30`
          }}
        >
          <div className="flex items-center space-x-3">
            <Link className="w-8 h-8" style={{ color: themeConfig.colors.primary }} />
            <div>
              <h3 
                className="font-semibold text-lg"
                style={{ color: themeConfig.colors.text }}
              >
                Connection Status
              </h3>
              <p 
                className="text-sm"
                style={{ color: themeConfig.colors.textSecondary }}
              >
                {isConnected ? 'API is connected and ready' : 'API connection not established'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center space-x-1"
              style={{
                backgroundColor: isConnected 
                  ? `${themeConfig.colors.success}20` 
                  : `${themeConfig.colors.textSecondary}20`,
                color: isConnected 
                  ? themeConfig.colors.success 
                  : themeConfig.colors.textSecondary
              }}
            >
              {isConnected ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </Badge>
            
            <Button
              onClick={testConnection}
              disabled={!apiKey || !apiEndpoint || isLoading}
              style={{
                backgroundColor: themeConfig.colors.primary,
                color: themeConfig.colors.background
              }}
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiConnections;
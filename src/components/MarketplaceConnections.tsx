import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Store, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MarketplaceConnection {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
  description: string;
}

const MarketplaceConnections: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const { toast } = useToast();
  const themeConfig = getThemeConfig(theme, themeMode);

  const [marketplaces] = useState<MarketplaceConnection[]>([
    {
      id: 'ebay',
      name: 'eBay',
      logo: 'https://logos-world.net/wp-content/uploads/2020/11/eBay-Logo.png',
      connected: false,
      description: 'Connect to eBay for automated listing management'
    },
    {
      id: 'amazon',
      name: 'Amazon',
      logo: 'https://logos-world.net/wp-content/uploads/2020/04/Amazon-Logo.png',
      connected: false,
      description: 'Connect to Amazon Seller Central for product listings'
    }
  ]);

  const handleConnect = (marketplace: MarketplaceConnection) => {
    toast({
      title: "Coming Soon",
      description: `${marketplace.name} integration will be available in a future update.`,
      duration: 3000,
    });
  };

  return (
    <Card 
      className="backdrop-blur-sm border"
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
          <Store className="w-6 h-6 mr-3" />
          Marketplace Connections
        </CardTitle>
        <p 
          className="text-lg"
          style={{ color: themeConfig.colors.textSecondary }}
        >
          Connect your accounts to enable one-click auto-listing
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {marketplaces.map((marketplace) => (
          <div 
            key={marketplace.id}
            className="flex items-center justify-between p-4 rounded-lg border"
            style={{
              backgroundColor: `${themeConfig.colors.background}50`,
              borderColor: `${themeConfig.colors.border}30`
            }}
          >
            <div className="flex items-center space-x-4">
              <img 
                src={marketplace.logo} 
                alt={`${marketplace.name} logo`}
                className="w-12 h-12 object-contain rounded"
              />
              <div>
                <h3 
                  className="font-semibold text-lg"
                  style={{ color: themeConfig.colors.text }}
                >
                  {marketplace.name}
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: themeConfig.colors.textSecondary }}
                >
                  {marketplace.description}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge 
                variant={marketplace.connected ? "default" : "secondary"}
                className="flex items-center space-x-1"
                style={{
                  backgroundColor: marketplace.connected 
                    ? `${themeConfig.colors.success}20` 
                    : `${themeConfig.colors.textSecondary}20`,
                  color: marketplace.connected 
                    ? themeConfig.colors.success 
                    : themeConfig.colors.textSecondary
                }}
              >
                {marketplace.connected ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>{marketplace.connected ? 'Connected' : 'Not Connected'}</span>
              </Badge>
              <Button
                onClick={() => handleConnect(marketplace)}
                disabled={marketplace.connected}
                style={{
                  backgroundColor: marketplace.connected 
                    ? `${themeConfig.colors.textSecondary}30` 
                    : themeConfig.colors.primary,
                  color: marketplace.connected 
                    ? themeConfig.colors.textSecondary 
                    : themeConfig.colors.background
                }}
              >
                {marketplace.connected ? 'Connected' : 'Connect'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MarketplaceConnections;
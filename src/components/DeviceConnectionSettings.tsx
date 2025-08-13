import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { toast } from '@/components/ui/use-toast';
import { Glasses, Bluetooth, Search, Eye } from 'lucide-react';

const smartGlassesDevices = [
  'Ray-Ban Meta Smart Glasses',
  'Vuzix Blade 2',
  'Magic Leap 2',
  'Microsoft HoloLens 2',
  'Nreal Air',
  'Rokid Air'
];

const DeviceConnectionSettings: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const [isSearching, setIsSearching] = useState(false);
  const [foundDevices, setFoundDevices] = useState<string[]>([]);
  const [hudMode, setHudMode] = useState(false);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleConnectToSmartGlasses = () => {
    setIsSearching(true);
    setFoundDevices([]);
    
    toast({
      title: "Searching for Devices",
      description: "Scanning for compatible smart glasses...",
    });

    setTimeout(() => {
      const randomDevices = smartGlassesDevices
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1);
      
      setFoundDevices(randomDevices);
      setIsSearching(false);
      
      toast({
        title: "Devices Found",
        description: `Found ${randomDevices.length} compatible device(s)`,
      });
    }, 3000);
  };

  const handleConnectDevice = (deviceName: string) => {
    toast({
      title: "Connecting...",
      description: `Pairing with ${deviceName}`,
    });

    setTimeout(() => {
      toast({
        title: "Connection Successful",
        description: `Connected to ${deviceName}`,
      });
    }, 2000);
  };

  return (
    <Card 
      className="backdrop-blur-sm border"
      style={{
        backgroundColor: `${themeConfig.colors.surface}90`,
        borderColor: `${themeConfig.colors.border}50`,
      }}
    >
      <CardHeader>
        <CardTitle 
          className="flex items-center"
          style={{ 
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.heading
          }}
        >
          <Glasses className="w-5 h-5 mr-2" />
          Device Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Button
            onClick={handleConnectToSmartGlasses}
            disabled={isSearching}
            className="w-full"
            style={{
              backgroundColor: themeConfig.colors.primary,
              color: 'white'
            }}
          >
            {isSearching ? (
              <>
                <Search className="w-4 h-4 mr-2 animate-spin" />
                Searching for Smart Glasses...
              </>
            ) : (
              <>
                <Bluetooth className="w-4 h-4 mr-2" />
                Connect to Smart Glasses
              </>
            )}
          </Button>

          {foundDevices.length > 0 && (
            <div className="space-y-2">
              <h4 
                className="font-medium"
                style={{ color: themeConfig.colors.text }}
              >
                Available Devices:
              </h4>
              {foundDevices.map((device, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start"
                  style={{
                    borderColor: `${themeConfig.colors.border}50`,
                    color: themeConfig.colors.text
                  }}
                  onClick={() => handleConnectDevice(device)}
                >
                  <Glasses className="w-4 h-4 mr-2" />
                  {device}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4" style={{ color: themeConfig.colors.text }} />
            <span style={{ color: themeConfig.colors.text }}>Enable HUD Mode</span>
          </div>
          <Switch
            checked={hudMode}
            onCheckedChange={(checked) => {
              setHudMode(checked);
              toast({
                title: checked ? "HUD Mode Enabled" : "HUD Mode Disabled",
                description: checked ? "Smart glasses display activated" : "Smart glasses display deactivated",
              });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceConnectionSettings;
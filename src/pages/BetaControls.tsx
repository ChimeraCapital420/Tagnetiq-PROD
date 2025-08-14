// FILE: src/pages/BetaControls.tsx (CREATE THIS NEW FILE)
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBeta, FeatureFlags } from '@/contexts/BetaContext';

const BetaControls: React.FC = () => {
  const { flags, setFlag, loading } = useBeta();

  if (loading) {
    return <div>Loading beta controls...</div>;
  }

  const handleToggle = (flag: keyof FeatureFlags) => {
    setFlag(flag, !flags[flag]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Beta Feature Controls</CardTitle>
          <CardDescription>Toggle experimental features on and off.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(flags).map((key) => {
            const flagKey = key as keyof FeatureFlags;
            return (
              <div key={flagKey} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor={flagKey} className="text-base">
                    {flagKey.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  </Label>
                </div>
                <Switch
                  id={flagKey}
                  checked={flags[flagKey]}
                  onCheckedChange={() => handleToggle(flagKey)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default BetaControls;
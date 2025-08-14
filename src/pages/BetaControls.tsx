import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFeatureFlags, FeatureFlag } from '@/lib/featureFlags'; // Import our new hook

const BetaControls: React.FC = () => {
  const { flags, loading, updateFlag } = useFeatureFlags();

  if (loading) {
    return <div className="container mx-auto p-8">Loading feature flags...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Beta Feature Controls</CardTitle>
          <CardDescription>Toggle experimental features on and off for all beta testers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flags.map((flag: FeatureFlag) => (
            <div key={flag.key} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={flag.key} className="text-base">
                  {flag.key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Label>
              </div>
              <Switch
                id={flag.key}
                checked={flag.enabled}
                onCheckedChange={(isChecked) => updateFlag(flag.key, isChecked)}
              />
            </div>
          ))}
          {/* Stress Test Mode - Placeholder */}
           <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="stress-test" className="text-base text-muted-foreground">
                  Stress Test Mode
                </Label>
              </div>
              <Switch id="stress-test" disabled />
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BetaControls;
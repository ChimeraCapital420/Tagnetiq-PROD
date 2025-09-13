// FILE: src/components/profile/OracleVisualizerSelector.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, Waves, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface VisualizerOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VISUALIZER_OPTIONS: VisualizerOption[] = [
  {
    id: 'cymatic',
    name: 'Cymatic Resonance',
    description: 'Sacred geometry patterns that pulse with the Oracle\'s voice',
    icon: Waves
  },
  {
    id: 'generative',
    name: 'Generative Abstract',
    description: 'Dynamic particle systems that dance to speech frequencies',
    icon: Sparkles
  }
];

const OracleVisualizerSelector: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { t } = useTranslation();
  const [selectedVisualizer, setSelectedVisualizer] = useState<string>(
    profile?.settings?.oracle_visualizer_preference || 'cymatic'
  );
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleVisualizerChange = async (visualizerId: string) => {
    if (!profile) return;

    setSelectedVisualizer(visualizerId);
    setSaving(true);

    const oldSettings = profile.settings || {};
    const newSettings = { ...oldSettings, oracle_visualizer_preference: visualizerId };
    
    // Optimistic update
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      // Rollback on error
      setSelectedVisualizer(oldSettings?.oracle_visualizer_preference || 'cymatic');
      setProfile({ ...profile, settings: oldSettings });
      toast.error(t('oracle.visualizer.saveFailed', 'Failed to save visualizer preference'));
    } else {
      toast.success(t('oracle.visualizer.saved', 'Oracle visualizer updated'));
    }
    
    setSaving(false);
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
    if (!showPreview) {
      // Trigger a brief Oracle speech for preview
      window.dispatchEvent(new CustomEvent('oracle:preview', { 
        detail: { visualizer: selectedVisualizer } 
      }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {t('oracle.visualizer.title', 'Oracle Visual Form')}
        </CardTitle>
        <CardDescription>
          {t('oracle.visualizer.description', 'Choose how the Oracle manifests visually when speaking')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedVisualizer}
          onValueChange={handleVisualizerChange}
          disabled={saving}
          className="grid gap-4"
        >
          {VISUALIZER_OPTIONS.map((option) => (
            <div key={option.id}>
              <RadioGroupItem
                value={option.id}
                id={option.id}
                className="peer sr-only"
              />
              <Label
                htmlFor={option.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg border-2 border-muted bg-popover p-4",
                  "hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                  "peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                )}
              >
                <option.icon className="h-6 w-6 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium leading-none">{option.name}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePreview}
            className="w-full"
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OracleVisualizerSelector;
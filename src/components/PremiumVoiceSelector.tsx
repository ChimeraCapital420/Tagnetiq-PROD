// FILE: src/components/PremiumVoiceSelector.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Sparkles, Globe, Mic, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTts } from '@/hooks/useTts';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface PremiumVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  description: string;
  tier: 'standard' | 'premium' | 'ultra';
}

const PremiumVoiceSelector: React.FC = () => {
  const { profile, setProfile, session } = useAuth();
  const { speak, cancel, isSpeaking } = useTts();
  const { i18n, t } = useTranslation();
  const [selectedVoice, setSelectedVoice] = useState<string | null>(
    profile?.settings?.premium_voice_id || null
  );
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<PremiumVoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch available voices from API
  useEffect(() => {
    const fetchVoices = async () => {
      if (!session) return;
      
      try {
        const response = await fetch('/api/oracle/voices', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices);
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, [session]);

  // Filter voices by current language
  const availableVoices = voices.filter(
    voice => voice.language === i18n.language
  );

  const handleVoiceSelect = async (voiceId: string) => {
    if (!profile) return;

    const oldSettings = profile.settings || {};
    const newSettings = { ...oldSettings, premium_voice_id: voiceId };
    
    // Optimistic update
    setSelectedVoice(voiceId);
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      // Rollback on error
      setSelectedVoice(oldSettings?.premium_voice_id || null);
      setProfile({ ...profile, settings: oldSettings });
      toast.error(t('premiumVoice.saveFailed', 'Failed to save voice preference'));
    } else {
      toast.success(t('premiumVoice.saved', 'Premium voice selected'));
    }
  };

  const handlePreview = async (voice: PremiumVoice) => {
    if (playingVoice === voice.id) {
      cancel();
      setPlayingVoice(null);
      return;
    }

    cancel();
    setPlayingVoice(voice.id);
    
    // Generate preview text based on language
    const previewTexts: Record<string, string> = {
      en: `Hello, I am ${voice.name}, your Tagnetiq Oracle. Let me analyze this asset for you.`,
      es: `Hola, soy ${voice.name}, tu Oráculo de Tagnetiq. Permíteme analizar este activo para ti.`,
      fr: `Bonjour, je suis ${voice.name}, votre Oracle Tagnetiq. Laissez-moi analyser cet actif pour vous.`,
      it: `Ciao, sono ${voice.name}, il tuo Oracolo Tagnetiq. Analizziamo insieme questo bene.`,
    };
    
    const previewText = previewTexts[voice.language] || previewTexts.en;
    
    // Use the premium voice for preview
    await speak(previewText, null, voice.id);
  };

  useEffect(() => {
    if (!isSpeaking) {
      setPlayingVoice(null);
    }
  }, [isSpeaking]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ultra': return 'text-purple-500 border-purple-500';
      case 'premium': return 'text-blue-500 border-blue-500';
      default: return 'text-green-500 border-green-500';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'ultra': return <Sparkles className="h-3 w-3" />;
      case 'premium': return <Mic className="h-3 w-3" />;
      default: return <Globe className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (availableVoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Globe className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            {t('premiumVoice.noVoices', 'No premium voices available for your language yet.')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('premiumVoice.comingSoon', 'More voices coming soon!')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {availableVoices.map((voice) => (
        <Card
          key={voice.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            selectedVoice === voice.id && "ring-2 ring-primary"
          )}
          onClick={() => handleVoiceSelect(voice.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{voice.name}</h4>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getTierColor(voice.tier))}
                  >
                    {getTierIcon(voice.tier)}
                    <span className="ml-1">{voice.tier}</span>
                  </Badge>
                  {voice.accent && (
                    <span className="text-xs text-muted-foreground">
                      ({voice.accent})
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {voice.description}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(voice);
                }}
              >
                {playingVoice === voice.id ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PremiumVoiceSelector;
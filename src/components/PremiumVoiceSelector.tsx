// FILE: src/components/PremiumVoiceSelector.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Sparkles, Globe, Mic } from 'lucide-react';
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
  preview_text: string;
  tier: 'standard' | 'premium' | 'ultra';
}

const PREMIUM_VOICES: PremiumVoice[] = [
  // English voices
  {
    id: 'oracle-nova-en',
    name: 'Nova',
    language: 'en',
    gender: 'female',
    accent: 'American',
    description: 'Confident and professional with a modern edge',
    preview_text: 'Hello, I am Nova, your Tagnetiq Oracle. Let me analyze this asset for you.',
    tier: 'premium'
  },
  {
    id: 'oracle-atlas-en',
    name: 'Atlas',
    language: 'en',
    gender: 'male',
    accent: 'British',
    description: 'Distinguished and authoritative with refined articulation',
    preview_text: 'Greetings, I am Atlas. Together, we shall uncover the true value of your assets.',
    tier: 'premium'
  },
  {
    id: 'oracle-sage-en',
    name: 'Sage',
    language: 'en',
    gender: 'neutral',
    accent: 'International',
    description: 'Wise and calming with perfect clarity',
    preview_text: 'Welcome. I am Sage, here to guide you through your asset evaluation journey.',
    tier: 'ultra'
  },
  // Spanish voices
  {
    id: 'oracle-luna-es',
    name: 'Luna',
    language: 'es',
    gender: 'female',
    accent: 'Castilian',
    description: 'Elegante y sofisticada con calidez natural',
    preview_text: 'Hola, soy Luna, tu Oráculo de Tagnetiq. Permíteme analizar este activo para ti.',
    tier: 'premium'
  },
  {
    id: 'oracle-sol-es',
    name: 'Sol',
    language: 'es',
    gender: 'male',
    accent: 'Latin American',
    description: 'Amigable y confiable con energía positiva',
    preview_text: 'Saludos, soy Sol. Juntos descubriremos el verdadero valor de tus activos.',
    tier: 'standard'
  },
  // French voices
  {
    id: 'oracle-amelie-fr',
    name: 'Amélie',
    language: 'fr',
    gender: 'female',
    accent: 'Parisian',
    description: 'Sophistiquée et précise avec une touche d\'élégance',
    preview_text: 'Bonjour, je suis Amélie, votre Oracle Tagnetiq. Laissez-moi analyser cet actif pour vous.',
    tier: 'premium'
  },
  // Italian voices
  {
    id: 'oracle-marco-it',
    name: 'Marco',
    language: 'it',
    gender: 'male',
    accent: 'Tuscan',
    description: 'Carismatico e professionale con passione italiana',
    preview_text: 'Ciao, sono Marco, il tuo Oracolo Tagnetiq. Analizziamo insieme questo bene.',
    tier: 'premium'
  }
];

const PremiumVoiceSelector: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { speak, cancel, isSpeaking } = useTts();
  const { i18n, t } = useTranslation();
  const [selectedVoice, setSelectedVoice] = useState<string | null>(
    profile?.settings?.premium_voice_id || null
  );
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  // Filter voices by current language
  const availableVoices = PREMIUM_VOICES.filter(
    voice => voice.language === i18n.language
  );

  const handleVoiceSelect = async (voiceId: string) => {
    if (!profile) return;

    const oldSettings = profile.settings;
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
    
    // Use the premium voice for preview
    await speak(voice.preview_text, null, voice.id);
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
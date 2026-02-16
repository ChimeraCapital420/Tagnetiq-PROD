// FILE: src/components/PremiumVoiceSelector.tsx
// Premium Voice Picker — language tabs, search, gender filter, preview playback
// Mobile-first: full-width cards, large tap targets, minimal scrolling
// Supports curated Oracle voices (Pro) + full ElevenLabs library (Elite)

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Play, Pause, Sparkles, Globe, Mic, Loader2,
  Search, Check, Crown, Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTts } from '@/hooks/useTts';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  description: string;
  preview_text?: string;
  preview_url?: string;
  tier: string;
  curated: boolean;
  category?: string;
}

interface LanguageInfo {
  code: string;
  name: string;
  count: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

const PremiumVoiceSelector: React.FC = () => {
  const { profile, setProfile, session } = useAuth();
  const { speak, cancel, isSpeaking } = useTts();
  const { i18n, t } = useTranslation();

  const [selectedVoice, setSelectedVoice] = useState<string | null>(
    profile?.settings?.premium_voice_id || null
  );
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [tier, setTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  // Filters
  const [langFilter, setLangFilter] = useState<string>(i18n.language || 'en');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio ref for ElevenLabs preview URLs
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // ── Fetch voices from API ───────────────────────────────
  useEffect(() => {
    const fetchVoices = async () => {
      if (!session) return;

      try {
        const response = await fetch('/api/oracle/voices', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices || []);
          setLanguages(data.languages || []);
          setTier(data.tier || 'free');

          // If user's language has no voices, default to 'all'
          const hasLang = (data.voices || []).some(
            (v: VoiceOption) => v.language === i18n.language
          );
          if (!hasLang && data.voices?.length > 0) {
            setLangFilter('all');
          }
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, [session, i18n.language]);

  // ── Filter voices ───────────────────────────────────────
  const filteredVoices = useMemo(() => {
    let filtered = voices;

    if (langFilter && langFilter !== 'all') {
      filtered = filtered.filter(v => v.language === langFilter || v.language === 'multi');
    }

    if (genderFilter && genderFilter !== 'all') {
      filtered = filtered.filter(v => v.gender === genderFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.accent || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [voices, langFilter, genderFilter, searchQuery]);

  // ── Select voice ────────────────────────────────────────
  const handleVoiceSelect = async (voiceId: string) => {
    if (!profile) return;

    const oldSettings = profile.settings || {};
    const newSettings = { ...oldSettings, premium_voice_id: voiceId };

    setSelectedVoice(voiceId);
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      setSelectedVoice(oldSettings?.premium_voice_id || null);
      setProfile({ ...profile, settings: oldSettings });
      toast.error('Failed to save voice preference');
    } else {
      toast.success('Voice selected');
    }
  };

  // ── Preview voice ───────────────────────────────────────
  const handlePreview = async (voice: VoiceOption) => {
    // Toggle off
    if (playingVoice === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPlayingVoice(voice.id);

    // If voice has a direct preview URL (ElevenLabs library), use it
    if (voice.preview_url) {
      try {
        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        audio.addEventListener('ended', () => setPlayingVoice(null));
        audio.addEventListener('error', () => setPlayingVoice(null));
        await audio.play();
        return;
      } catch {
        // Fall through to TTS preview
      }
    }

    // Curated voices: generate speech via our API
    const previewTexts: Record<string, string> = {
      en: 'Hey, I think I found something worth looking at. Let me tell you about it.',
      es: 'Oye, creo que encontré algo interesante. Déjame contarte.',
      fr: "Hé, je pense avoir trouvé quelque chose d'intéressant. Laissez-moi vous en parler.",
      it: 'Ciao, penso di aver trovato qualcosa di interessante. Lascia che te lo racconti.',
      de: 'Hey, ich glaube ich habe etwas Interessantes gefunden. Lass mich dir davon erzählen.',
      pt: 'Ei, acho que encontrei algo interessante. Deixa eu te contar.',
    };

    const text = voice.preview_text || previewTexts[voice.language] || previewTexts.en;
    await speak(text, null, voice.id);
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    cancel();
    setPlayingVoice(null);
  };

  useEffect(() => {
    if (!isSpeaking && !audioRef.current) {
      setPlayingVoice(null);
    }
  }, [isSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPreview();
  }, []);

  // ── Tier badge ──────────────────────────────────────────
  const getTierBadge = (voiceTier: string) => {
    if (voiceTier === 'elite') {
      return (
        <Badge variant="outline" className="text-xs text-purple-500 border-purple-500">
          <Crown className="h-3 w-3 mr-1" />
          Elite
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">
        <Sparkles className="h-3 w-3 mr-1" />
        Oracle
      </Badge>
    );
  };

  // ── Loading state ───────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Upgrade prompt ──────────────────────────────────────
  if (tier === 'free' || tier === 'starter') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm font-medium">Premium Oracle Voices</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upgrade to Pro to give your Oracle a natural, human-quality voice.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── No voices for language ──────────────────────────────
  if (voices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Globe className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            No premium voices available yet. Check back soon!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Language tabs ─────────────────────────────────── */}
      {languages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={langFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs h-8"
            onClick={() => setLangFilter('all')}
          >
            All ({voices.length})
          </Button>
          {languages.map(lang => (
            <Button
              key={lang.code}
              variant={langFilter === lang.code ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 text-xs h-8"
              onClick={() => setLangFilter(lang.code)}
            >
              {lang.name} ({lang.count})
            </Button>
          ))}
        </div>
      )}

      {/* ── Search + gender filter ────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search voices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'male', 'female'] as const).map(g => (
            <Button
              key={g}
              variant={genderFilter === g ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9 px-2.5"
              onClick={() => setGenderFilter(g)}
            >
              {g === 'all' ? 'All' : g === 'male' ? '♂' : '♀'}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Voice list ────────────────────────────────────── */}
      <div className="grid gap-2.5 max-h-[60vh] overflow-y-auto">
        {filteredVoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No voices match your filters. Try a different language or search term.
          </p>
        ) : (
          filteredVoices.map(voice => (
            <Card
              key={voice.id}
              className={cn(
                'cursor-pointer transition-all active:scale-[0.98] touch-manipulation',
                'hover:shadow-md',
                selectedVoice === voice.id && 'ring-2 ring-primary bg-primary/5',
              )}
              onClick={() => handleVoiceSelect(voice.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{voice.name}</h4>
                      {getTierBadge(voice.tier)}
                      {voice.accent && (
                        <span className="text-xs text-muted-foreground">
                          {voice.accent}
                        </span>
                      )}
                      {selectedVoice === voice.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {voice.description}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={e => {
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
          ))
        )}
      </div>

      {/* ── Voice count ───────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-center">
        {filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''} available
        {tier === 'pro' && (
          <span> • <span className="text-purple-500">Upgrade to Elite</span> for 100+ voices in 29 languages</span>
        )}
      </p>
    </div>
  );
};

export default PremiumVoiceSelector;

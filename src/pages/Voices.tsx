// FILE: src/pages/Voices.tsx (unchanged from previous build)
// Full-screen Oracle Voice Picker — the "choose your Oracle's voice" experience
// Mobile-first: large cards, audio preview, language groups, search
// Linked from Settings → "Choose Voice" button
// Route: /voices (protected)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Play, Pause, Check, ChevronLeft, Search,
  Sparkles, Crown, Lock, Loader2, Volume2,
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
// PAGE
// =============================================================================

const VoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, setProfile, session } = useAuth();
  const { speak, cancel, isSpeaking } = useTts();
  const { i18n } = useTranslation();

  const [selectedVoice, setSelectedVoice] = useState<string | null>(
    profile?.settings?.premium_voice_id || null
  );
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [tier, setTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [langFilter, setLangFilter] = useState<string>(i18n.language || 'en');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track what was selected when page opened (for "unsaved changes" UX)
  const [originalVoice] = useState<string | null>(
    profile?.settings?.premium_voice_id || null
  );

  // ── Fetch voices ────────────────────────────────────────
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

          // Default to user's language, fall back to 'all'
          const hasLang = (data.voices || []).some(
            (v: VoiceOption) => v.language === i18n.language
          );
          if (!hasLang && data.voices?.length > 0) {
            setLangFilter('all');
          }
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        toast.error('Failed to load voices');
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

  // Group by curated vs library
  const curatedVoices = filteredVoices.filter(v => v.curated);
  const libraryVoices = filteredVoices.filter(v => !v.curated);

  // ── Preview voice ───────────────────────────────────────
  const handlePreview = async (voice: VoiceOption) => {
    if (playingVoice === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPlayingVoice(voice.id);

    // ElevenLabs preview URL (library voices)
    if (voice.preview_url) {
      try {
        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        audio.addEventListener('ended', () => setPlayingVoice(null));
        audio.addEventListener('error', () => setPlayingVoice(null));
        await audio.play();
        return;
      } catch {
        // Fall through
      }
    }

    // Curated: generate via our TTS API
    const previewTexts: Record<string, string> = {
      en: 'Hey, I think I found something worth looking at. This could be a really solid flip.',
      es: 'Oye, creo que encontré algo que vale la pena. Esto podría ser un buen negocio.',
      fr: "Hé, je pense avoir trouvé quelque chose d'intéressant. Ça pourrait valoir le coup.",
      it: 'Ciao, penso di aver trovato qualcosa di interessante. Potrebbe essere un buon affare.',
      de: 'Hey, ich glaube ich habe etwas Interessantes gefunden. Das könnte sich lohnen.',
      pt: 'Ei, acho que encontrei algo interessante. Pode ser um bom negócio.',
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
    if (!isSpeaking && !audioRef.current) setPlayingVoice(null);
  }, [isSpeaking]);

  useEffect(() => {
    return () => stopPreview();
  }, []);

  // ── Save selection ──────────────────────────────────────
  const handleSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };

  const handleConfirm = async () => {
    if (!profile || !selectedVoice) return;

    setSaving(true);
    const oldSettings = profile.settings || {};
    const newSettings = { ...oldSettings, premium_voice_id: selectedVoice };

    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      setProfile({ ...profile, settings: oldSettings });
      toast.error('Failed to save voice');
    } else {
      toast.success('Oracle voice updated');
      navigate(-1);
    }
  };

  // ── Voice card ──────────────────────────────────────────
  const VoiceCard = ({ voice }: { voice: VoiceOption }) => {
    const isSelected = selectedVoice === voice.id;
    const isPlaying = playingVoice === voice.id;

    return (
      <Card
        className={cn(
          'transition-all active:scale-[0.98] touch-manipulation cursor-pointer',
          isSelected
            ? 'ring-2 ring-primary bg-primary/5 shadow-md'
            : 'hover:shadow-sm',
        )}
        onClick={() => handleSelect(voice.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Play button */}
            <Button
              variant={isPlaying ? 'default' : 'outline'}
              size="icon"
              className={cn(
                'shrink-0 h-12 w-12 rounded-full transition-all',
                isPlaying && 'animate-pulse',
              )}
              onClick={e => {
                e.stopPropagation();
                handlePreview(voice);
              }}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{voice.name}</h3>
                {voice.curated ? (
                  <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Oracle
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-purple-500 border-purple-500">
                    <Crown className="h-3 w-3 mr-1" />
                    Elite
                  </Badge>
                )}
                {voice.accent && (
                  <span className="text-xs text-muted-foreground">{voice.accent}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {voice.description}
              </p>
            </div>

            {/* Selected check */}
            {isSelected && (
              <div className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading voices...</p>
        </div>
      </div>
    );
  }

  // ── Upgrade gate ────────────────────────────────────────
  if (tier === 'free' || tier === 'starter') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold">Premium Oracle Voices</h2>
          <p className="text-muted-foreground max-w-md">
            Give your Oracle a natural, human-quality voice. Upgrade to Pro to choose
            from our curated collection, or Elite for access to hundreds of voices in 29 languages.
          </p>
          <Button size="lg">Upgrade to Pro</Button>
        </div>
      </div>
    );
  }

  // ── Main page ───────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-6 pb-32 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Choose Your Oracle's Voice</h1>
          <p className="text-sm text-muted-foreground">
            Tap a voice to select, press play to preview
          </p>
        </div>
      </div>

      {/* Language tabs */}
      {languages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-4 px-4">
          <Button
            variant={langFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => setLangFilter('all')}
          >
            All ({voices.length})
          </Button>
          {languages.map(lang => (
            <Button
              key={lang.code}
              variant={langFilter === lang.code ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => setLangFilter(lang.code)}
            >
              {lang.name} ({lang.count})
            </Button>
          ))}
        </div>
      )}

      {/* Search + gender filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search voices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'male', 'female'] as const).map(g => (
            <Button
              key={g}
              variant={genderFilter === g ? 'default' : 'outline'}
              size="sm"
              className="px-3"
              onClick={() => setGenderFilter(g)}
            >
              {g === 'all' ? 'All' : g === 'male' ? '♂' : '♀'}
            </Button>
          ))}
        </div>
      </div>

      {/* Voice list */}
      {filteredVoices.length === 0 ? (
        <div className="text-center py-12">
          <Volume2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No voices match your filters. Try a different language or search term.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Curated section */}
          {curatedVoices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Oracle Voices
              </h2>
              <div className="space-y-2.5">
                {curatedVoices.map(voice => (
                  <VoiceCard key={voice.id} voice={voice} />
                ))}
              </div>
            </div>
          )}

          {/* Library section (Elite only) */}
          {libraryVoices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Crown className="h-4 w-4" />
                ElevenLabs Library ({libraryVoices.length})
              </h2>
              <div className="space-y-2.5">
                {libraryVoices.map(voice => (
                  <VoiceCard key={voice.id} voice={voice} />
                ))}
              </div>
            </div>
          )}

          {/* Upgrade nudge for Pro users */}
          {tier === 'pro' && (
            <Card className="border-dashed border-purple-500/30">
              <CardContent className="p-4 text-center">
                <Crown className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Want more voices?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade to Elite for 100+ voices in 29 languages from the ElevenLabs library
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sticky confirm bar */}
      {selectedVoice && selectedVoice !== originalVoice && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50">
          <div className="container mx-auto max-w-2xl flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {voices.find(v => v.id === selectedVoice)?.name || 'Selected voice'}
              </p>
              <p className="text-xs text-muted-foreground">Tap confirm to save</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedVoice(originalVoice)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoicesPage;

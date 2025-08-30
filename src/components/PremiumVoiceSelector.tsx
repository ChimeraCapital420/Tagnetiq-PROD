// FILE: src/components/PremiumVoiceSelector.tsx
// STATUS: NEW - A UI for selecting and previewing premium Oracle voices.

import React, { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// This would typically come from a config file or API
const premiumVoices = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'Female', accent: 'American', description: 'Calm and Raspy' },
  { id: '29vD33N1CtxCmqQRPO9k', name: 'Drew', gender: 'Male', accent: 'American', description: 'Well-rounded and Energetic' },
  { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', gender: 'Male', accent: 'American', description: 'Deep and Smooth' },
  { id: '5Q0t7uMcjvnagumLfvMk', name: 'Dave', gender: 'Male', accent: 'British', description: 'Informative and Deep' },
];

const PremiumVoiceSelector: React.FC = () => {
    const { profile, setProfile } = useAuth();
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

    const handlePreview = async (voiceId: string, text: string) => {
        setPlayingVoiceId(voiceId);
        try {
            const response = await fetch('/api/oracle/generate-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId }),
            });
            if (!response.ok) throw new Error('Could not generate preview.');
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => setPlayingVoiceId(null);
        } catch (error) {
            toast.error("Preview failed", { description: (error as Error).message });
            setPlayingVoiceId(null);
        }
    };
    
    const handleSelect = async (voiceId: string) => {
        if (!profile) return;
        const oldSettings = profile.settings;
        const newSettings = { ...oldSettings, premium_voice_id: voiceId };
        setProfile({ ...profile, settings: newSettings });

        const { error } = await supabase
            .from('profiles')
            .update({ settings: newSettings })
            .eq('id', profile.id);
        
        if (error) {
            setProfile({ ...profile, settings: oldSettings }); // Revert on error
            toast.error("Failed to save voice", { description: error.message });
        } else {
            toast.success("Oracle voice updated!");
        }
    };

    return (
        <div className="space-y-4">
            {premiumVoices.map((voice) => {
                const isSelected = profile?.settings?.premium_voice_id === voice.id;
                return (
                    <Card key={voice.id} className={cn("p-4 flex items-center justify-between", isSelected && "border-primary")}>
                        <div>
                            <CardTitle className="text-base">{voice.name}</CardTitle>
                            <CardDescription>{voice.accent} • {voice.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                size="icon" 
                                variant="outline" 
                                onClick={() => handlePreview(voice.id, `Hello, I am ${voice.name}. This is how I sound.`)}
                                disabled={!!playingVoiceId}
                            >
                                {playingVoiceId === voice.id ? <Loader2 className="animate-spin" /> : <Play />}
                            </Button>
                            <Button onClick={() => handleSelect(voice.id)} disabled={isSelected}>
                                {isSelected && <Check className="mr-2"/>}
                                {isSelected ? 'Selected' : 'Select'}
                            </Button>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default PremiumVoiceSelector;

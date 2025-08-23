// FILE: src/components/GlobalVoiceControl.tsx

import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useStt } from '@/hooks/useStt';
import { useTts } from '@/hooks/useTts'; // Import TTS hook
import { useAuth } from '@/contexts/AuthContext'; // Import Auth to get voice preference
import { cn } from '@/lib/utils';

interface GlobalVoiceControlProps {
  onCommand: (command: string, ttsContext: { speak: Function, voiceURI: string | null }) => void;
}

const GlobalVoiceControl: React.FC<GlobalVoiceControlProps> = ({ onCommand }) => {
  const { isListening, transcript, startListening, stopListening, isSupported } = useStt();
  const { speak } = useTts(); // Get the speak function
  const { profile } = useAuth(); // Get profile for voice preference
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (transcript) {
      setIsProcessing(true);
      // Pass the TTS context along with the command
      onCommand(transcript.toLowerCase(), { speak, voiceURI: profile?.settings?.tts_voice_uri || null });
      setTimeout(() => setIsProcessing(false), 1500); // Give time for feedback to be spoken
    }
  }, [transcript, onCommand, speak, profile]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  const getIcon = () => {
    if (isProcessing) return <Loader2 className="h-6 w-6 animate-spin" />;
    if (isListening) return <MicOff className="h-6 w-6" />;
    return <Mic className="h-6 w-6" />;
  };

  return (
    <button
      onClick={toggleListening}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-300",
        isListening ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90",
        isProcessing && "bg-muted-foreground cursor-not-allowed"
      )}
      disabled={isProcessing}
      aria-label={isListening ? "Stop listening" : "Start listening"}
    >
      {getIcon()}
    </button>
  );
};

export default GlobalVoiceControl;
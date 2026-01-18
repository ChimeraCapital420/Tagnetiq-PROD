// src/hooks/useVoiceManager.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceManager, VoiceManagerConfig } from '../lib/voice/voice-manager';
import { VoiceOption } from '../lib/voice/providers/base';
import { useAuth } from './useAuth.js';
import { toast } from 'sonner';

export function useVoiceManager() {
  const { user } = useAuth();
  const [voiceManager, setVoiceManager] = useState<VoiceManager | null>(null);
  const [currentVoice, setCurrentVoice] = useState<VoiceOption | null>(null);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingQueueRef = useRef<Array<() => Promise<void>>>([]);

  // Initialize voice manager
  useEffect(() => {
    const config: VoiceManagerConfig = {
      defaultProvider: user?.preferences?.voiceProvider || 'elevenlabs',
      defaultLanguage: user?.preferences?.language || 'en',
      cacheEnabled: true,
      providers: {
        elevenlabs: { apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY! },
        googleCloud: { credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}') },
        azure: {
          apiKey: process.env.AZURE_SPEECH_API_KEY!,
          region: process.env.AZURE_SPEECH_REGION || 'eastus'
        },
        openai: { apiKey: process.env.OPENAI_API_KEY! }
      }
    };

    const manager = new VoiceManager(config);
    setVoiceManager(manager);
    setAvailableVoices(manager.getAllVoices());

    // Load user's saved voice preference
    if (user?.preferences?.voiceId) {
      const savedVoice = manager.getAllVoices().find(
        v => v.id === user.preferences.voiceId
      );
      if (savedVoice) setCurrentVoice(savedVoice);
    }
  }, [user]);

  // Process speaking queue
  const processQueue = useCallback(async () => {
    if (speakingQueueRef.current.length === 0 || isSpeaking) return;

    setIsSpeaking(true);
    const task = speakingQueueRef.current.shift();
    
    if (task) {
      try {
        await task();
      } catch (error) {
        console.error('Speech error:', error);
      }
    }

    setIsSpeaking(false);
    
    // Process next in queue
    if (speakingQueueRef.current.length > 0) {
      processQueue();
    }
  }, [isSpeaking]);

  // Speak function with queue management
  const speak = useCallback(async (
    text: string, 
    options?: {
      priority?: 'high' | 'normal' | 'low';
      emotion?: string;
      language?: string;
      interrupt?: boolean;
    }
  ) => {
    if (!voiceManager || !currentVoice) {
      // Fallback to browser speech
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.speak(utterance);
      return;
    }

    const speakTask = async () => {
      await voiceManager.speak(text, {
        voiceId: currentVoice.id,
        provider: currentVoice.provider,
        language: options?.language,
        emotion: options?.emotion,
        priority: options?.priority,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: (error) => {
          console.error('Speech error:', error);
          toast.error('Failed to speak. Check your voice settings.');
        }
      });
    };

    if (options?.interrupt) {
      // Clear queue and stop current speech
      speakingQueueRef.current = [];
      speechSynthesis.cancel();
      await speakTask();
    } else if (options?.priority === 'high') {
      // Add to front of queue
      speakingQueueRef.current.unshift(speakTask);
    } else {
      // Add to end of queue
      speakingQueueRef.current.push(speakTask);
    }

    processQueue();
  }, [voiceManager, currentVoice, processQueue]);

  // Test voice function
  const testVoice = useCallback(async (
    text: string,
    settings?: any
  ) => {
    setIsProcessing(true);
    try {
      await speak(text, {
        ...settings,
        interrupt: true
      });
    } finally {
      setIsProcessing(false);
    }
  }, [speak]);

  // Clone voice function
  const cloneVoice = useCallback(async (params: {
    name: string;
    description: string;
    files: File[];
  }) => {
    if (!voiceManager) throw new Error('Voice manager not initialized');

    setIsProcessing(true);
    try {
      // Currently only ElevenLabs supports voice cloning
      const elevenLabsProvider = voiceManager['providers'].get('elevenlabs');
      if (!elevenLabsProvider) {
        throw new Error('ElevenLabs provider not available');
      }

      const voiceId = await elevenLabsProvider.cloneVoice(
        params.name,
        params.description,
        params.files
      );

      // Save to user preferences
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customVoiceId: voiceId
        })
      });

      return voiceId;
    } finally {
      setIsProcessing(false);
    }
  }, [voiceManager]);

  // Stop all speech
  const stopSpeaking = useCallback(() => {
    speakingQueueRef.current = [];
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    voiceManager,
    currentVoice,
    setCurrentVoice,
    availableVoices,
    speak,
    testVoice,
    cloneVoice,
    stopSpeaking,
    isProcessing,
    isSpeaking
  };
}
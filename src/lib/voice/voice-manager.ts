// src/lib/voice/voice-manager.ts
import { VoiceProvider } from './providers/base';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { GoogleCloudProvider } from './providers/google-cloud';
import { AzureProvider } from './providers/azure';
import { OpenAIProvider } from './providers/openai';
import { WebSpeechProvider } from './providers/web-speech';

export interface VoiceManagerConfig {
  defaultProvider?: string;
  defaultVoice?: string;
  defaultLanguage?: string;
  cacheEnabled?: boolean;
  providers: {
    elevenlabs?: { apiKey: string };
    googleCloud?: { credentials: any };
    azure?: { apiKey: string; region: string };
    openai?: { apiKey: string };
  };
}

export class VoiceManager {
  private providers: Map<string, VoiceProvider> = new Map();
  private audioCache: Map<string, ArrayBuffer> = new Map();
  private config: VoiceManagerConfig;
  private audioContext: AudioContext;

  constructor(config: VoiceManagerConfig) {
    this.config = config;
    this.audioContext = new AudioContext();
    this.initializeProviders();
  }

  private initializeProviders() {
    // Always include Web Speech API as fallback
    this.providers.set('webspeech', new WebSpeechProvider());

    if (this.config.providers.elevenlabs) {
      this.providers.set(
        'elevenlabs', 
        new ElevenLabsProvider(this.config.providers.elevenlabs.apiKey)
      );
    }

    if (this.config.providers.googleCloud) {
      this.providers.set(
        'google-cloud',
        new GoogleCloudProvider(this.config.providers.googleCloud.credentials)
      );
    }

    if (this.config.providers.azure) {
      this.providers.set(
        'azure',
        new AzureProvider(
          this.config.providers.azure.apiKey,
          this.config.providers.azure.region
        )
      );
    }

    if (this.config.providers.openai) {
      this.providers.set(
        'openai',
        new OpenAIProvider(this.config.providers.openai.apiKey)
      );
    }
  }

  async speak(
    text: string, 
    options?: {
      voiceId?: string;
      provider?: string;
      language?: string;
      emotion?: string;
      speed?: number;
      priority?: 'high' | 'normal' | 'low';
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      options?.onStart?.();

      // Get provider and voice
      const providerName = options?.provider || this.config.defaultProvider || 'webspeech';
      const provider = this.providers.get(providerName);
      
      if (!provider) {
        throw new Error(`Voice provider ${providerName} not found`);
      }

      // Detect language if not specified
      const language = options?.language || await this.detectLanguage(text);
      
      // Get voice ID
      const voiceId = options?.voiceId || this.getDefaultVoice(providerName, language);

      // Check cache
      const cacheKey = `${providerName}:${voiceId}:${text}:${language}`;
      let audioData: ArrayBuffer;

      if (this.config.cacheEnabled && this.audioCache.has(cacheKey)) {
        audioData = this.audioCache.get(cacheKey)!;
      } else {
        // Synthesize speech
        audioData = await provider.synthesize(text, {
          voiceId,
          language,
          emotion: options?.emotion,
          speed: options?.speed || 1.0
        });

        // Cache the result
        if (this.config.cacheEnabled) {
          this.audioCache.set(cacheKey, audioData);
        }
      }

      // Play the audio
      await this.playAudio(audioData, options?.priority);
      
      options?.onEnd?.();
    } catch (error) {
      console.error('Voice synthesis error:', error);
      options?.onError?.(error as Error);
      
      // Fallback to web speech
      if (options?.provider !== 'webspeech') {
        await this.speak(text, { ...options, provider: 'webspeech' });
      }
    }
  }

  private async detectLanguage(text: string): Promise<string> {
    // Simple language detection - in production, use a proper library
    const patterns = {
      es: /[áéíóúñ¿¡]/i,
      fr: /[àâçèéêëîïôùûü]/i,
      de: /[äöüß]/i,
      it: /[àèéìíîòóùú]/i,
      pt: /[ãõçáéíóú]/i,
      ru: /[а-я]/i,
      zh: /[\u4e00-\u9fa5]/,
      ja: /[\u3040-\u309f\u30a0-\u30ff]/,
      ko: /[\uac00-\ud7af]/,
      ar: /[\u0600-\u06ff]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }

    return 'en';
  }

  private getDefaultVoice(provider: string, language: string): string {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return 'default';

    const voices = providerInstance.supportedVoices.filter(
      v => v.language === language || v.language === 'multilingual'
    );

    // Prefer professional style for Jarvis
    const professionalVoice = voices.find(v => v.style === 'professional');
    return professionalVoice?.id || voices[0]?.id || 'default';
  }

  private async playAudio(audioData: ArrayBuffer, priority?: string): Promise<void> {
    const audioBuffer = await this.audioContext.decodeAudioData(audioData);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Add effects based on voice style
    const gainNode = this.audioContext.createGain();
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start(0);
    });
  }

  // Get available voices for UI
  getAllVoices(): VoiceOption[] {
    const allVoices: VoiceOption[] = [];
    
    for (const provider of this.providers.values()) {
      allVoices.push(...provider.supportedVoices);
    }
    
    return allVoices;
  }

  // Estimate monthly cost based on usage
  estimateMonthlyCost(
    wordsPerDay: number, 
    voiceId: string, 
    provider: string
  ): number {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return 0;

    const avgCharactersPerWord = 5;
    const charactersPerMonth = wordsPerDay * avgCharactersPerWord * 30;
    const textSample = 'a'.repeat(Math.floor(charactersPerMonth));
    
    return providerInstance.estimateCost(textSample, voiceId);
  }
}
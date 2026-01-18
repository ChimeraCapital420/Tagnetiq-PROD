// src/lib/voice/providers/elevenlabs.ts
import { VoiceProvider, VoiceOption, VoiceSynthesisOptions, VoiceDetails } from './base.js';

export class ElevenLabsProvider implements VoiceProvider {
  id = 'elevenlabs';
  name = 'ElevenLabs';
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  supportedLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'nl', 'sv', 
    'cs', 'da', 'fi', 'el', 'hu', 'no', 'ro', 'sk', 'tr', 'ar',
    'zh', 'ja', 'ko', 'hi', 'id', 'ms', 'vi', 'th', 'he'
  ];

  supportedVoices: VoiceOption[] = [
    // Premium voices
    {
      id: 'rachel',
      name: 'Rachel',
      language: 'en',
      gender: 'female',
      accent: 'american',
      style: 'professional',
      provider: 'elevenlabs',
      tags: ['premium', 'neural']
    },
    {
      id: 'antoni',
      name: 'Antoni',
      language: 'en',
      gender: 'male',
      accent: 'british',
      style: 'professional',
      provider: 'elevenlabs',
      tags: ['premium', 'neural']
    },
    // AI-generated voices
    {
      id: 'jarvis-prime',
      name: 'Jarvis Prime',
      language: 'multilingual',
      gender: 'male',
      style: 'robotic',
      provider: 'elevenlabs',
      tags: ['custom', 'ai-generated', 'premium']
    },
    {
      id: 'aria-collector',
      name: 'Aria Collector',
      language: 'multilingual',
      gender: 'female',
      style: 'enthusiastic',
      provider: 'elevenlabs',
      tags: ['custom', 'specialized']
    }
  ];

  async synthesize(text: string, options: VoiceSynthesisOptions): Promise<ArrayBuffer> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${options.voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.75,
          style: options.style || 0.5,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  async cloneVoice(name: string, description: string, files: File[]): Promise<string> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    
    files.forEach((file, index) => {
      formData.append(`files[${index}]`, file);
    });

    const response = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    const result = await response.json();
    return result.voice_id;
  }

  getVoiceDetails(voiceId: string): VoiceDetails {
    const voice = this.supportedVoices.find(v => v.id === voiceId);
    return {
      voiceId,
      provider: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
      languageCode: voice?.language || 'en',
      supportedEmotions: ['neutral', 'happy', 'sad', 'angry', 'dull', 'excited'],
      customizable: true
    };
  }

  estimateCost(text: string, voiceId: string): number {
    // ElevenLabs pricing: ~$0.30 per 1000 characters for premium voices
    const characters = text.length;
    const voice = this.supportedVoices.find(v => v.id === voiceId);
    const isPremium = voice?.tags?.includes('premium');
    const rate = isPremium ? 0.0003 : 0.0001;
    return characters * rate;
  }
}
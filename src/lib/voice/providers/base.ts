// src/lib/voice/providers/base.ts
export interface VoiceProvider {
  id: string;
  name: string;
  supportedLanguages: string[];
  supportedVoices: VoiceOption[];
  
  synthesize(text: string, options: VoiceSynthesisOptions): Promise<ArrayBuffer>;
  getVoiceDetails(voiceId: string): VoiceDetails;
  estimateCost(text: string, voiceId: string): number;
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  style?: string; // 'professional', 'casual', 'robotic', 'emotional'
  provider: string;
  previewUrl?: string;
  tags?: string[]; // ['premium', 'neural', 'cloned']
}

export interface VoiceSynthesisOptions {
  voiceId: string;
  language: string;
  speed?: number; // 0.5 - 2.0
  pitch?: number; // -20 - 20
  emotion?: string;
  stability?: number; // For ElevenLabs
  similarityBoost?: number; // For ElevenLabs
  style?: number; // 0-100 for expressiveness
}

export interface VoiceDetails {
  voiceId: string;
  provider: string;
  modelId?: string;
  languageCode: string;
  ssmlGender?: string;
  naturalSampleRate?: number;
  supportedEmotions?: string[];
  customizable?: boolean;
}
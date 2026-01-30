// FILE: src/features/boardroom/voice/types.ts
// Voice communication system types

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface VoiceSession {
  id: string;
  meeting_id?: string;
  session_type: 'full_board' | 'one_on_one' | 'quick_question';
  target_member?: string; // For 1:1 sessions
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'waiting';
  started_at: string;
  ended_at?: string;
}

export interface VoiceMessage {
  id: string;
  session_id: string;
  type: 'user_speech' | 'board_response';
  member_slug?: string;
  transcript: string;
  audio_url?: string;
  confidence?: number;
  duration_ms: number;
  created_at: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface VoiceSettings {
  autoPlay: boolean;
  playbackSpeed: number;
  preferredVoices: Record<string, string>; // member_slug -> voice_id
  pushToTalk: boolean;
  wakeWord?: string; // "Hey Board" or similar
  silenceTimeout: number; // ms before auto-submit
}

export interface VoiceMemberConfig {
  member_slug: string;
  voice_id: string;
  voice_provider: 'elevenlabs' | 'openai' | 'google' | 'azure';
  speaking_rate: number;
  pitch: number;
  style?: string; // "conversational", "professional", etc.
}

// ============================================================================
// REAL-TIME STATE TYPES
// ============================================================================

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  currentSpeaker?: string;
  transcript: string;
  interimTranscript: string;
  error?: string;
  audioLevel: number; // 0-100 for visualization
}

// ============================================================================
// VOICE COMMAND TYPES
// ============================================================================

export interface VoiceCommand {
  type: 'switch_member' | 'end_session' | 'repeat' | 'clarify' | 'vote' | 'summarize';
  params?: Record<string, string>;
  confidence: number;
}

export const VOICE_COMMANDS: Record<string, VoiceCommand['type']> = {
  'talk to': 'switch_member',
  'speak with': 'switch_member',
  'let me hear from': 'switch_member',
  'end meeting': 'end_session',
  'end session': 'end_session',
  "that's all": 'end_session',
  'say that again': 'repeat',
  'repeat that': 'repeat',
  'what do you mean': 'clarify',
  'explain that': 'clarify',
  "let's vote": 'vote',
  'call a vote': 'vote',
  'summarize': 'summarize',
  'give me the summary': 'summarize',
};

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface VoiceChatRequest {
  message: string;
  meeting_id?: string;
  session_type: 'full_board' | 'one_on_one';
  target_members: string[];
  generate_audio: boolean;
}

export interface VoiceChatResponse {
  responses: Array<{
    member: {
      slug: string;
      name: string;
      title: string;
      ai_provider: string;
    };
    content: string;
    audio?: string; // Base64 encoded
  }>;
}

export interface TranscribeRequest {
  audio: Blob;
}

export interface TranscribeResponse {
  text: string;
  duration_ms?: number;
  confidence?: number;
}
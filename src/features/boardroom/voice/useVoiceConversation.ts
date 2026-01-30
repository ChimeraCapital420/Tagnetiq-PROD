// FILE: src/features/boardroom/voice/useVoiceConversation.ts
// Complete voice conversation hook for real-time board communication
// Handles speech-to-text, AI response, and text-to-speech in a natural flow

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { 
  VoiceState, 
  VoiceSession, 
  VoiceSettings,
  VoiceCommand,
  VOICE_COMMANDS,
} from './types';
import type { BoardMember, Message } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface UseVoiceConversationOptions {
  members: BoardMember[];
  getMemberBySlug: (slug: string) => BoardMember | undefined;
  meetingId?: string;
  settings?: Partial<VoiceSettings>;
  onMessageReceived?: (message: Message) => void;
  onSessionEnd?: () => void;
}

interface UseVoiceConversationReturn {
  // State
  state: VoiceState;
  session: VoiceSession | null;
  messages: Message[];
  activeMember: BoardMember | null;
  
  // Actions
  startSession: (type: 'full_board' | 'one_on_one', targetMember?: string) => Promise<void>;
  endSession: () => void;
  startListening: () => void;
  stopListening: () => void;
  cancelSpeech: () => void;
  switchMember: (memberSlug: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<VoiceSettings>) => void;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  autoPlay: true,
  playbackSpeed: 1.0,
  preferredVoices: {},
  pushToTalk: false,
  silenceTimeout: 2000,
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useVoiceConversation(
  options: UseVoiceConversationOptions
): UseVoiceConversationReturn {
  const { 
    members, 
    getMemberBySlug, 
    meetingId,
    settings: initialSettings,
    onMessageReceived,
    onSessionEnd,
  } = options;

  // State
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    transcript: '',
    interimTranscript: '',
    audioLevel: 0,
  });
  
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMember, setActiveMember] = useState<BoardMember | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // ========================================
  // SPEECH RECOGNITION SETUP
  // ========================================

  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      // Reset silence timeout on any speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      if (interimText) {
        setState(prev => ({ ...prev, interimTranscript: interimText }));
      }

      if (finalText) {
        setState(prev => ({
          ...prev,
          transcript: prev.transcript + ' ' + finalText,
          interimTranscript: '',
        }));

        // Check for voice commands
        const command = detectVoiceCommand(finalText);
        if (command) {
          handleVoiceCommand(command, finalText);
          return;
        }

        // Set silence timeout for auto-submit
        if (!settings.pushToTalk) {
          silenceTimeoutRef.current = setTimeout(() => {
            processUserSpeech();
          }, settings.silenceTimeout);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setState(prev => ({ ...prev, error: event.error }));
      }
    };

    recognition.onend = () => {
      // Restart if we're still supposed to be listening
      if (state.isListening && !state.isSpeaking) {
        recognition.start();
      }
    };

    return recognition;
  }, [settings.pushToTalk, settings.silenceTimeout]);

  // ========================================
  // VOICE COMMAND DETECTION
  // ========================================

  const detectVoiceCommand = (text: string): VoiceCommand | null => {
    const lowerText = text.toLowerCase().trim();
    
    for (const [phrase, type] of Object.entries(VOICE_COMMANDS)) {
      if (lowerText.includes(phrase)) {
        // Extract parameters based on command type
        let params: Record<string, string> = {};
        
        if (type === 'switch_member') {
          // Extract member name after the command phrase
          const afterPhrase = lowerText.split(phrase)[1]?.trim();
          if (afterPhrase) {
            params.memberName = afterPhrase;
          }
        }
        
        return { type, params, confidence: 0.9 };
      }
    }
    
    return null;
  };

  const handleVoiceCommand = useCallback((command: VoiceCommand, rawText: string) => {
    switch (command.type) {
      case 'switch_member':
        const memberName = command.params?.memberName;
        if (memberName) {
          // Fuzzy match member name
          const member = members.find(m => 
            m.name.toLowerCase().includes(memberName.toLowerCase()) ||
            m.slug.toLowerCase().includes(memberName.toLowerCase())
          );
          if (member) {
            switchMember(member.slug);
            speakResponse(`Switching to ${member.name}.`);
          } else {
            speakResponse(`I couldn't find a board member named ${memberName}.`);
          }
        }
        break;
        
      case 'end_session':
        speakResponse('Ending the session. Goodbye.');
        setTimeout(() => endSession(), 2000);
        break;
        
      case 'repeat':
        if (messages.length > 0) {
          const lastBoardMessage = [...messages].reverse().find(m => m.sender_type === 'board_member');
          if (lastBoardMessage) {
            speakResponse(lastBoardMessage.content, lastBoardMessage.member_slug);
          }
        }
        break;
        
      case 'summarize':
        // Request summary from the board
        processUserSpeech('Please summarize what we\'ve discussed so far.');
        break;
        
      case 'vote':
        processUserSpeech('I\'d like to call for a vote on what we\'ve been discussing.');
        break;
    }
    
    // Clear the transcript since we handled the command
    setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
  }, [members, messages]);

  // ========================================
  // PROCESS USER SPEECH → AI → TTS
  // ========================================

  const processUserSpeech = useCallback(async (overrideText?: string) => {
    const text = overrideText || state.transcript.trim();
    if (!text) return;

    setState(prev => ({ 
      ...prev, 
      isListening: false, 
      isProcessing: true,
      transcript: '',
      interimTranscript: '',
    }));

    // Stop recognition while processing
    recognitionRef.current?.stop();

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) throw new Error('Not authenticated');

      // Add user message to local state
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        sender_type: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      onMessageReceived?.(userMessage);

      // Determine which members should respond
      const respondingMembers = session?.session_type === 'one_on_one' && activeMember
        ? [activeMember.slug]
        : members.map(m => m.slug);

      // Call the voice chat API
      const response = await fetch('/api/boardroom/voice-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          meeting_id: meetingId,
          session_type: session?.session_type || 'full_board',
          target_members: respondingMembers,
          generate_audio: settings.autoPlay,
        }),
      });

      if (!response.ok) throw new Error('Voice chat request failed');

      const data = await response.json();

      // Process responses
      for (const resp of (data.responses || [])) {
        const boardMessage: Message = {
          id: `board-${resp.member?.slug}-${Date.now()}`,
          sender_type: 'board_member',
          member_slug: resp.member?.slug,
          content: resp.content,
          created_at: new Date().toISOString(),
          ai_provider: resp.member?.ai_provider,
        };
        
        setMessages(prev => [...prev, boardMessage]);
        onMessageReceived?.(boardMessage);

        // Speak the response
        if (settings.autoPlay && resp.audio) {
          await playAudioResponse(resp.audio, resp.member?.slug);
        } else if (settings.autoPlay) {
          await speakResponse(resp.content, resp.member?.slug);
        }
      }

    } catch (error) {
      console.error('Voice processing error:', error);
      toast.error('Failed to process voice message');
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
      
      // Resume listening if not in push-to-talk mode
      if (!settings.pushToTalk) {
        startListening();
      }
    }
  }, [state.transcript, session, activeMember, members, meetingId, settings, onMessageReceived]);

  // ========================================
  // TEXT-TO-SPEECH
  // ========================================

  const playAudioResponse = async (audioBase64: string, memberSlug?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        setState(prev => ({ ...prev, isSpeaking: true, currentSpeaker: memberSlug }));

        // Convert base64 to blob
        const audioData = atob(audioBase64);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Play audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        audioRef.current = new Audio(audioUrl);
        audioRef.current.playbackRate = settings.playbackSpeed;
        
        audioRef.current.onended = () => {
          setState(prev => ({ ...prev, isSpeaking: false, currentSpeaker: undefined }));
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audioRef.current.onerror = () => {
          setState(prev => ({ ...prev, isSpeaking: false, currentSpeaker: undefined }));
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Audio playback failed'));
        };

        audioRef.current.play();
      } catch (error) {
        setState(prev => ({ ...prev, isSpeaking: false }));
        reject(error);
      }
    });
  };

  const speakResponse = async (text: string, memberSlug?: string): Promise<void> => {
    // Use the voice API to generate speech
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      setState(prev => ({ ...prev, isSpeaking: true, currentSpeaker: memberSlug }));

      const response = await fetch('/api/boardroom/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          text,
          member_slug: memberSlug || 'griffin', // Default voice
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audio) {
          await playAudioResponse(data.audio, memberSlug);
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setState(prev => ({ ...prev, isSpeaking: false, currentSpeaker: undefined }));
    }
  };

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  const startSession = useCallback(async (
    type: 'full_board' | 'one_on_one',
    targetMember?: string
  ) => {
    const newSession: VoiceSession = {
      id: `voice-${Date.now()}`,
      meeting_id: meetingId,
      session_type: type,
      target_member: targetMember,
      status: 'idle',
      started_at: new Date().toISOString(),
    };
    
    setSession(newSession);
    setMessages([]);
    
    if (type === 'one_on_one' && targetMember) {
      const member = getMemberBySlug(targetMember);
      setActiveMember(member || null);
      
      if (member) {
        // Greet the user
        await speakResponse(
          `Hello, this is ${member.name}. I'm ready to discuss whatever's on your mind.`,
          member.slug
        );
      }
    } else {
      setActiveMember(null);
      await speakResponse(
        'The board is assembled and ready. What would you like to discuss?'
      );
    }
    
    // Start listening
    startListening();
  }, [meetingId, getMemberBySlug]);

  const endSession = useCallback(() => {
    recognitionRef.current?.stop();
    audioRef.current?.pause();
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    
    setSession(prev => prev ? { ...prev, status: 'idle', ended_at: new Date().toISOString() } : null);
    setState({
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      transcript: '',
      interimTranscript: '',
      audioLevel: 0,
    });
    
    onSessionEnd?.();
  }, [onSessionEnd]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }
    
    try {
      recognitionRef.current?.start();
      setState(prev => ({ ...prev, isListening: true, error: undefined }));
    } catch (error) {
      // Already started, ignore
    }
  }, [initSpeechRecognition]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState(prev => ({ ...prev, isListening: false }));
    
    // Process any remaining speech
    if (state.transcript.trim()) {
      processUserSpeech();
    }
  }, [state.transcript, processUserSpeech]);

  const cancelSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState(prev => ({ ...prev, isSpeaking: false, currentSpeaker: undefined }));
  }, []);

  const switchMember = useCallback((memberSlug: string) => {
    const member = getMemberBySlug(memberSlug);
    if (member) {
      setActiveMember(member);
      setSession(prev => prev ? { ...prev, target_member: memberSlug } : null);
    }
  }, [getMemberBySlug]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // ========================================
  // CLEANUP
  // ========================================

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    session,
    messages,
    activeMember,
    startSession,
    endSession,
    startListening,
    stopListening,
    cancelSpeech,
    switchMember,
    updateSettings,
  };
}

// Helper constant export
export { VOICE_COMMANDS };

export default useVoiceConversation;
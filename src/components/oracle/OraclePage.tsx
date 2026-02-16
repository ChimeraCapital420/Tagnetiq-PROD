// FILE: src/components/oracle/OraclePage.tsx
// Thin orchestrator — wires hooks to components
// All logic lives in hooks/, all UI lives in components/
// Enhanced: camera/vision, content creation, energy tracking
// Sprint N gaps: learning, introductions, push prompt, smart chip routing
// Sprint N+: Voice-only mode — cymatics only, no text bubbles

import React, { useState, useEffect, useCallback } from 'react';
import { useTts, useOracleSpeakingState } from '@/hooks/useTts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useOracleChat, useConversationMode } from './hooks';
import { useOracleExtras } from './hooks/useOracleExtras';
import {
  OracleHeader,
  OracleChatMessages,
  OracleInputBar,
  OracleHistoryPanel,
  ConversationBanner,
} from './components';
import type { ChatMessage, VisionMode, CameraCapture } from './types';

// =============================================================================
// DISPLAY MODE — controls what the user sees
// =============================================================================

// 'full'   = text bubbles + voice + cymatics (default)
// 'voice'  = cymatics visualization only, no text. Tap to peek last message
// 'silent' = text only, no voice, no cymatics
type DisplayMode = 'full' | 'voice' | 'silent';

// =============================================================================
// SMART CHIP DETECTION — routes special chips to the right handler
// =============================================================================

const LEARN_TRIGGERS = [
  /^teach me/i,
  /^authentication 101/i,
  /^how.*(grading|authentication|negotiat)/i,
];

const INTRO_TRIGGERS = [
  /collectors.*connect/i,
  /find.*collectors/i,
  /similar interests/i,
];

const LISTING_TRIGGERS = [
  /^(write|create|make).*(listing|description)/i,
  /^list.*(on|my)\s+(ebay|mercari|poshmark|facebook|amazon|whatnot)/i,
  /^list it/i,
];

function detectChipIntent(message: string): 'learn' | 'intro' | 'listing' | 'chat' {
  if (LEARN_TRIGGERS.some(r => r.test(message))) return 'learn';
  if (INTRO_TRIGGERS.some(r => r.test(message))) return 'intro';
  if (LISTING_TRIGGERS.some(r => r.test(message))) return 'listing';
  return 'chat';
}

// =============================================================================
// PAGE
// =============================================================================

export default function OraclePage() {
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full');
  const [peekMessage, setPeekMessage] = useState(false);

  const { profile } = useAuth();
  const { speak, isSpeaking, cancel: cancelSpeech } = useTts();
  const globalSpeaking = useOracleSpeakingState();
  const push = usePushNotifications();

  const voiceURI = profile?.settings?.tts_voice_uri || null;
  const premiumVoiceId = profile?.settings?.premium_voice_id || null;

  // ── Chat hook ─────────────────────────────────────────
  const chat = useOracleChat();

  // ── Extras hook (learning, introductions, content) ────
  const extras = useOracleExtras({
    appendMessage: chat.appendMessage,
    setLoading: chat.setIsLoading,
  });

  // ── Conversation mode hook ────────────────────────────
  const convo = useConversationMode({
    isLoading: chat.isLoading,
    onTranscript: async (text) => {
      const response = await chat.sendMessage(text);
      if (response && autoSpeak) {
        speak(response, voiceURI, premiumVoiceId, chat.currentEnergy);
        convo.queueAutoListen();
      } else if (response && convo.conversationMode) {
        convo.queueAutoListen();
      }
    },
  });

  // ── Init ──────────────────────────────────────────────
  useEffect(() => {
    chat.loadRecentConversation().then(greeting => {
      if (greeting && autoSpeak) {
        speak(greeting, voiceURI, premiumVoiceId);
      }
    });
  }, []);

  // ── Push notification prompt (after 3rd message) ──────
  useEffect(() => {
    if (
      push.supported
      && push.permission === 'default'
      && !push.subscribed
      && !pushPromptDismissed
      && chat.messages.length >= 6 // ~3 exchanges
    ) {
      // Don't auto-prompt — will show a subtle chip instead
    }
  }, [chat.messages.length, push.supported, push.permission, push.subscribed, pushPromptDismissed]);

  // ── Clear playing state when speech ends ──────────────
  useEffect(() => {
    if (!globalSpeaking && playingIdx !== null) setPlayingIdx(null);
  }, [globalSpeaking]);

  // ── Force auto-speak on when entering conversation mode
  useEffect(() => {
    if (convo.conversationMode) setAutoSpeak(true);
  }, [convo.conversationMode]);

  // ── Display mode sync ─────────────────────────────────
  // When switching to voice mode, enable auto-speak
  // When switching to silent, disable auto-speak
  useEffect(() => {
    if (displayMode === 'voice') {
      setAutoSpeak(true);
    } else if (displayMode === 'silent') {
      setAutoSpeak(false);
      cancelSpeech();
    }
  }, [displayMode]);

  // ── Hide peek overlay when speaking ends ──────────────
  useEffect(() => {
    if (!globalSpeaking && peekMessage) {
      // Keep peek visible for 3s after speech ends, then fade
      const timer = setTimeout(() => setPeekMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [globalSpeaking, peekMessage]);

  // ── Text send handler ─────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!chat.inputValue.trim()) return;
    const response = await chat.sendMessage(chat.inputValue);
    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId, chat.currentEnergy);
      convo.queueAutoListen();
    }
  }, [chat.inputValue, autoSpeak, speak, voiceURI, premiumVoiceId, chat.currentEnergy]);

  // ── Image/Vision send handler ─────────────────────────
  const handleSendImage = useCallback(async (
    capture: CameraCapture,
    mode: VisionMode,
    question?: string,
  ) => {
    if (!chat.sendImage) return;
    const response = await chat.sendImage(capture, mode, question);
    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId, chat.currentEnergy);
    }
  }, [chat.sendImage, autoSpeak, speak, voiceURI, premiumVoiceId, chat.currentEnergy]);

  // ── Hunt triage handler ───────────────────────────────
  const handleSendHunt = useCallback(async (
    capture: CameraCapture,
    askingPrice?: number,
  ) => {
    if (!chat.sendHunt) return;
    const response = await chat.sendHunt(capture, askingPrice);
    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId, chat.currentEnergy);
    }
  }, [chat.sendHunt, autoSpeak, speak, voiceURI, premiumVoiceId, chat.currentEnergy]);

  // ── Smart chip handler (routes to correct handler) ────
  const handleChipClick = useCallback(async (message: string) => {
    const intent = detectChipIntent(message);

    let response: string | null = null;

    switch (intent) {
      case 'learn': {
        // Extract topic from message
        const topicMatch = message.match(/(?:teach me (?:about |how )?)?(.+)/i);
        const topic = topicMatch?.[1] || message;
        response = await extras.sendLearn(topic);
        break;
      }
      case 'intro': {
        await extras.findMatches();
        return; // findMatches appends its own messages
      }
      case 'listing': {
        // Extract item and platform from message
        const platformMatch = message.match(/on\s+(ebay|mercari|poshmark|facebook|amazon|whatnot)/i);
        const platform = platformMatch?.[1]?.toLowerCase() || 'ebay';
        const itemMatch = message.match(/(?:list|listing for)\s+(?:my\s+)?["']?(.+?)["']?\s+(?:on|$)/i);
        const itemName = itemMatch?.[1] || '';
        if (itemName) {
          await extras.createListing(itemName, platform);
        } else {
          // Fallback: send as regular chat, Oracle will handle it
          response = await chat.sendMessage(message);
        }
        break;
      }
      default: {
        response = await chat.sendMessage(message);
        break;
      }
    }

    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId);
    }
  }, [autoSpeak, speak, voiceURI, premiumVoiceId, extras, chat]);

  // ── Play/stop individual messages ─────────────────────
  const handlePlay = useCallback((msg: ChatMessage, idx: number) => {
    if (playingIdx === idx && isSpeaking) {
      cancelSpeech();
      setPlayingIdx(null);
      return;
    }
    cancelSpeech();
    setPlayingIdx(idx);
    speak(msg.content, voiceURI, premiumVoiceId);
  }, [playingIdx, isSpeaking, cancelSpeech, speak, voiceURI, premiumVoiceId]);

  // ── History panel ─────────────────────────────────────
  const handleToggleHistory = useCallback(() => {
    setShowHistory(prev => {
      if (!prev) chat.loadConversationHistory();
      return !prev;
    });
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    const ok = await chat.loadConversation(id);
    if (ok) setShowHistory(false);
  }, []);

  // ── Auto-speak toggle ────────────────────────────────
  const handleToggleAutoSpeak = useCallback(() => {
    setAutoSpeak(prev => {
      if (isSpeaking) cancelSpeech();
      return !prev;
    });
  }, [isSpeaking, cancelSpeech]);

  // ── Display mode cycle ────────────────────────────────
  const handleCycleDisplayMode = useCallback(() => {
    setDisplayMode(prev => {
      if (prev === 'full') return 'voice';
      if (prev === 'voice') return 'silent';
      return 'full';
    });
  }, []);

  // ── Push notification helpers ─────────────────────────
  const handleEnablePush = useCallback(async () => {
    const success = await push.subscribe();
    if (success) {
      setPushPromptDismissed(true);
    }
  }, [push.subscribe]);

  // ── Build augmented quick chips ───────────────────────
  const augmentedChips = React.useMemo(() => {
    const chips = [...(chat.quickChips || [])];

    // Add push notification chip if eligible
    if (
      push.supported
      && push.permission === 'default'
      && !push.subscribed
      && !pushPromptDismissed
      && chat.messages.length >= 6
    ) {
      chips.push({
        label: '🔔 Enable alerts',
        message: '__ENABLE_PUSH__', // Special sentinel
      });
    }

    return chips.slice(0, 5); // Allow up to 5 with the push chip
  }, [chat.quickChips, push.supported, push.permission, push.subscribed, pushPromptDismissed, chat.messages.length]);

  // ── Augmented chip handler (intercepts push sentinel) ─
  const handleAugmentedChipClick = useCallback(async (message: string) => {
    if (message === '__ENABLE_PUSH__') {
      await handleEnablePush();
      return;
    }
    await handleChipClick(message);
  }, [handleChipClick, handleEnablePush]);

  // ── Get last assistant message for voice-only peek ────
  const lastAssistantMessage = React.useMemo(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') return chat.messages[i].content;
    }
    return null;
  }, [chat.messages]);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background">
      <OracleHeader
        isSpeaking={globalSpeaking}
        isListening={convo.isListening}
        conversationMode={convo.conversationMode}
        autoSpeak={autoSpeak}
        scanCount={chat.scanCount}
        vaultCount={chat.vaultCount}
        showHistory={showHistory}
        micSupported={convo.micSupported}
        displayMode={displayMode}
        onToggleConversationMode={convo.toggleConversationMode}
        onToggleHistory={handleToggleHistory}
        onNewConversation={() => chat.startNewConversation()}
        onToggleAutoSpeak={handleToggleAutoSpeak}
        onCycleDisplayMode={handleCycleDisplayMode}
      />

      <ConversationBanner
        active={convo.conversationMode}
        isListening={convo.isListening}
        isSpeaking={globalSpeaking}
        onEnd={convo.toggleConversationMode}
      />

      <OracleHistoryPanel
        visible={showHistory}
        conversations={chat.pastConversations}
        activeId={chat.conversationId}
        isLoading={chat.isLoadingHistory}
        onClose={() => setShowHistory(false)}
        onSelect={handleSelectConversation}
        onDelete={chat.deleteConversation}
      />

      {/* ── Voice-Only Mode: Cymatics + tap-to-peek ────── */}
      {displayMode === 'voice' ? (
        <div
          className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
          onClick={() => setPeekMessage(prev => !prev)}
        >
          {/* Cymatic visualization area — takes full space */}
          <div className="flex-1 flex items-center justify-center w-full">
            {globalSpeaking ? (
              <div className="relative">
                {/* Animated cymatics rings */}
                <div className="w-48 h-48 rounded-full border-2 border-primary/30 animate-ping absolute inset-0" />
                <div className="w-48 h-48 rounded-full border border-primary/20 animate-pulse" />
                <div className="w-36 h-36 rounded-full border-2 border-primary/50 animate-pulse absolute top-6 left-6" />
                <div className="w-24 h-24 rounded-full bg-primary/10 animate-pulse absolute top-12 left-12" />
                <div className="w-12 h-12 rounded-full bg-primary/30 absolute top-[4.5rem] left-[4.5rem] animate-bounce" />
              </div>
            ) : chat.isLoading ? (
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-2 border-muted-foreground/20 animate-pulse" />
                <div className="w-20 h-20 rounded-full border border-muted-foreground/10 animate-pulse absolute top-6 left-6" />
                <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                  Thinking...
                </p>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-32 h-32 rounded-full border border-muted-foreground/10 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20" />
                </div>
                <p className="text-xs text-muted-foreground">Tap to show text</p>
              </div>
            )}
          </div>

          {/* Peek overlay — shows last message on tap */}
          {peekMessage && lastAssistantMessage && (
            <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t p-4 max-h-[40vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {lastAssistantMessage}
              </p>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Tap anywhere to dismiss
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ── Full/Silent Mode: Normal chat messages ────── */
        <OracleChatMessages
          messages={chat.messages}
          isLoading={chat.isLoading}
          quickChips={augmentedChips}
          playingIdx={playingIdx}
          isSpeaking={globalSpeaking}
          onPlay={handlePlay}
          onChipClick={handleAugmentedChipClick}
        />
      )}

      <OracleInputBar
        inputValue={chat.inputValue}
        isLoading={chat.isLoading}
        isListening={convo.isListening}
        conversationMode={convo.conversationMode}
        micSupported={convo.micSupported}
        onInputChange={chat.setInputValue}
        onSend={handleSend}
        onVoice={convo.listen}
        onEndConversation={convo.toggleConversationMode}
        onSendImage={handleSendImage}
        onSendHunt={handleSendHunt}
      />
    </div>
  );
}

// FILE: src/components/oracle/OraclePage.tsx
// Thin orchestrator — wires hooks to components
// All logic lives in hooks/, all UI lives in components/
// Enhanced: camera/vision, content creation, energy tracking
// Sprint N gaps: learning, introductions, push prompt, smart chip routing

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
        onToggleConversationMode={convo.toggleConversationMode}
        onToggleHistory={handleToggleHistory}
        onNewConversation={() => chat.startNewConversation()}
        onToggleAutoSpeak={handleToggleAutoSpeak}
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

      <OracleChatMessages
        messages={chat.messages}
        isLoading={chat.isLoading}
        quickChips={augmentedChips}
        playingIdx={playingIdx}
        isSpeaking={globalSpeaking}
        onPlay={handlePlay}
        onChipClick={handleAugmentedChipClick}
      />

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

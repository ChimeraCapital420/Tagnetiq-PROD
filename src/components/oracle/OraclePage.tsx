// FILE: src/components/oracle/OraclePage.tsx
// Thin orchestrator — wires hooks to components
// All logic lives in hooks/, all UI lives in components/

import React, { useState, useEffect, useCallback } from 'react';
import { useTts, useOracleSpeakingState } from '@/hooks/useTts';
import { useAuth } from '@/contexts/AuthContext';
import { useOracleChat, useConversationMode } from './hooks';
import {
  OracleHeader,
  OracleChatMessages,
  OracleInputBar,
  OracleHistoryPanel,
  ConversationBanner,
} from './components';
import type { ChatMessage } from './types';

export default function OraclePage() {
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const { profile } = useAuth();
  const { speak, isSpeaking, cancel: cancelSpeech } = useTts();
  const globalSpeaking = useOracleSpeakingState();

  const voiceURI = profile?.settings?.tts_voice_uri || null;
  const premiumVoiceId = profile?.settings?.premium_voice_id || null;

  // ── Chat hook ─────────────────────────────────────────
  const chat = useOracleChat();

  // ── Conversation mode hook ────────────────────────────
  const convo = useConversationMode({
    isLoading: chat.isLoading,
    onTranscript: async (text) => {
      const response = await chat.sendMessage(text);
      if (response && autoSpeak) {
        speak(response, voiceURI, premiumVoiceId);
        convo.queueAutoListen();
      } else if (response && convo.conversationMode) {
        // Auto-speak off but conversation mode on — still auto-listen
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

  // ── Clear playing state when speech ends ──────────────
  useEffect(() => {
    if (!globalSpeaking && playingIdx !== null) setPlayingIdx(null);
  }, [globalSpeaking]);

  // ── Force auto-speak on when entering conversation mode
  useEffect(() => {
    if (convo.conversationMode) setAutoSpeak(true);
  }, [convo.conversationMode]);

  // ── Handlers ──────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!chat.inputValue.trim()) return;
    const response = await chat.sendMessage(chat.inputValue);
    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId);
      convo.queueAutoListen();
    }
  }, [chat.inputValue, autoSpeak, speak, voiceURI, premiumVoiceId]);

  const handleChipClick = useCallback(async (message: string) => {
    const response = await chat.sendMessage(message);
    if (response && autoSpeak) {
      speak(response, voiceURI, premiumVoiceId);
    }
  }, [autoSpeak, speak, voiceURI, premiumVoiceId]);

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

  const handleToggleAutoSpeak = useCallback(() => {
    setAutoSpeak(prev => {
      if (isSpeaking) cancelSpeech();
      return !prev;
    });
  }, [isSpeaking, cancelSpeech]);

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
        quickChips={chat.quickChips}
        playingIdx={playingIdx}
        isSpeaking={globalSpeaking}
        onPlay={handlePlay}
        onChipClick={handleChipClick}
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
      />
    </div>
  );
}
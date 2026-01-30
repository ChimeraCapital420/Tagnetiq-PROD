// FILE: src/features/boardroom/components/VoiceBoardroom.tsx
// Mobile-first voice interface for speaking with the board
// Full-screen immersive experience for voice conversations

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Volume2,
  VolumeX,
  Users,
  User,
  Settings,
  ChevronDown,
  Loader2,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceConversation } from '../voice/useVoiceConversation';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type { BoardMember, Message } from '../types';
import { AI_PROVIDER_COLORS } from '../constants';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceBoardroomProps {
  members: BoardMember[];
  getMemberBySlug: (slug: string) => BoardMember | undefined;
  meetingId?: string;
  onClose?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VoiceBoardroomContent: React.FC<VoiceBoardroomProps> = ({
  members,
  getMemberBySlug,
  meetingId,
  onClose,
}) => {
  const [sessionType, setSessionType] = useState<'full_board' | 'one_on_one' | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  const voice = useVoiceConversation({
    members,
    getMemberBySlug,
    meetingId,
    settings: {
      autoPlay: true,
      pushToTalk: false,
      silenceTimeout: 2500,
    },
    onSessionEnd: () => {
      setSessionType(null);
      setSelectedMember(null);
    },
  });

  // Start session handler
  const handleStartSession = (type: 'full_board' | 'one_on_one', memberSlug?: string) => {
    setSessionType(type);
    if (memberSlug) setSelectedMember(memberSlug);
    voice.startSession(type, memberSlug);
    setShowMemberSelect(false);
  };

  // ========================================
  // SESSION SELECTION SCREEN
  // ========================================

  if (!sessionType) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Voice Boardroom</h1>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronDown className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Session Type Selection */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Who would you like to speak with?</h2>
            <p className="text-muted-foreground">Choose a session type to begin</p>
          </div>

          {/* Full Board Option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleStartSession('full_board')}
            className="w-full max-w-sm p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 hover:border-primary/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg">Full Board Meeting</h3>
                <p className="text-sm text-muted-foreground">
                  Address all {members.length} board members
                </p>
              </div>
            </div>
            
            {/* Member avatars preview */}
            <div className="flex -space-x-2 mt-4 justify-center">
              {members.slice(0, 6).map((member) => (
                <Avatar key={member.slug} className="h-10 w-10 border-2 border-background">
                  <AvatarImage src={member.avatar_url} alt={member.name} />
                  <AvatarFallback>{member.name[0]}</AvatarFallback>
                </Avatar>
              ))}
              {members.length > 6 && (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border-2 border-background text-sm">
                  +{members.length - 6}
                </div>
              )}
            </div>
          </motion.button>

          {/* 1:1 Option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowMemberSelect(true)}
            className="w-full max-w-sm p-6 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 border-2 border-secondary/30 hover:border-secondary/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center">
                <User className="h-8 w-8 text-secondary-foreground" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg">1:1 Executive Session</h3>
                <p className="text-sm text-muted-foreground">
                  Private conversation with one member
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Member Selection Sheet */}
        <AnimatePresence>
          {showMemberSelect && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-x-0 bottom-0 bg-background rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Select Board Member</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowMemberSelect(false)}>
                  Cancel
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {members.map((member) => (
                    <motion.button
                      key={member.slug}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStartSession('one_on_one', member.slug)}
                      className="w-full p-4 rounded-xl bg-muted/50 hover:bg-muted flex items-center gap-4 transition-colors"
                    >
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={member.avatar_url} alt={member.name} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.title}</p>
                      </div>
                      <Badge className={cn("text-xs", AI_PROVIDER_COLORS[member.ai_provider])}>
                        {member.ai_provider}
                      </Badge>
                    </motion.button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========================================
  // ACTIVE VOICE SESSION SCREEN
  // ========================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          {voice.activeMember ? (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={voice.activeMember.avatar_url} alt={voice.activeMember.name} />
                <AvatarFallback>{voice.activeMember.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{voice.activeMember.name}</p>
                <p className="text-xs text-muted-foreground">{voice.activeMember.title}</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Full Board</p>
                <p className="text-xs text-muted-foreground">{members.length} members</p>
              </div>
            </>
          )}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Visual Feedback Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Speaking Member Avatar (animated) */}
        <div className="relative mb-8">
          {voice.state.currentSpeaker ? (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Avatar className="h-32 w-32 border-4 border-primary shadow-lg shadow-primary/25">
                <AvatarImage 
                  src={getMemberBySlug(voice.state.currentSpeaker)?.avatar_url} 
                  alt={getMemberBySlug(voice.state.currentSpeaker)?.name} 
                />
                <AvatarFallback>
                  {getMemberBySlug(voice.state.currentSpeaker)?.name[0]}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          ) : voice.activeMember ? (
            <Avatar className={cn(
              "h-32 w-32 border-4 transition-all duration-300",
              voice.state.isListening ? "border-green-500 shadow-lg shadow-green-500/25" : "border-muted"
            )}>
              <AvatarImage src={voice.activeMember.avatar_url} alt={voice.activeMember.name} />
              <AvatarFallback>{voice.activeMember.name[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn(
              "h-32 w-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center transition-all duration-300",
              voice.state.isListening && "ring-4 ring-green-500/50"
            )}>
              <Users className="h-16 w-16 text-primary" />
            </div>
          )}
          
          {/* Speaking indicator */}
          {voice.state.isSpeaking && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
            >
              <Badge variant="default" className="gap-1">
                <Volume2 className="h-3 w-3" />
                Speaking
              </Badge>
            </motion.div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center mb-6">
          {voice.state.isProcessing ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          ) : voice.state.isSpeaking ? (
            <p className="text-primary font-medium">
              {voice.state.currentSpeaker && getMemberBySlug(voice.state.currentSpeaker)?.name} is speaking...
            </p>
          ) : voice.state.isListening ? (
            <p className="text-green-500 font-medium flex items-center gap-2">
              <Radio className="h-4 w-4 animate-pulse" />
              Listening...
            </p>
          ) : (
            <p className="text-muted-foreground">Tap the microphone to speak</p>
          )}
        </div>

        {/* Live Transcript */}
        {showTranscript && (voice.state.transcript || voice.state.interimTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md text-center px-6 py-3 rounded-xl bg-muted/50"
          >
            <p className="text-sm">
              {voice.state.transcript}
              {voice.state.interimTranscript && (
                <span className="text-muted-foreground italic">
                  {voice.state.interimTranscript}
                </span>
              )}
            </p>
          </motion.div>
        )}
      </div>

      {/* Message History (collapsible) */}
      {showTranscript && voice.messages.length > 0 && (
        <div className="px-4 pb-4">
          <ScrollArea className="h-40 rounded-xl bg-muted/30 p-4">
            <div className="space-y-3">
              {voice.messages.slice(-5).map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "text-sm",
                    msg.sender_type === 'user' ? "text-right" : ""
                  )}
                >
                  {msg.sender_type === 'board_member' && msg.member_slug && (
                    <span className="font-medium text-primary">
                      {getMemberBySlug(msg.member_slug)?.name}:{' '}
                    </span>
                  )}
                  <span className={msg.sender_type === 'user' ? 'text-muted-foreground' : ''}>
                    {msg.content.substring(0, 100)}
                    {msg.content.length > 100 && '...'}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Control Bar */}
      <div className="p-6 border-t bg-background/80 backdrop-blur">
        <div className="flex items-center justify-center gap-6">
          {/* Mute/Cancel Speech */}
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={voice.cancelSpeech}
            disabled={!voice.state.isSpeaking}
          >
            {voice.state.isSpeaking ? (
              <VolumeX className="h-6 w-6" />
            ) : (
              <Volume2 className="h-6 w-6" />
            )}
          </Button>

          {/* Main Mic Button */}
          <motion.div
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant={voice.state.isListening ? "destructive" : "default"}
              size="icon"
              className={cn(
                "h-20 w-20 rounded-full shadow-lg transition-all duration-300",
                voice.state.isListening && "shadow-red-500/25 shadow-xl"
              )}
              onClick={() => {
                if (voice.state.isListening) {
                  voice.stopListening();
                } else {
                  voice.startListening();
                }
              }}
              disabled={voice.state.isProcessing || voice.state.isSpeaking}
            >
              {voice.state.isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : voice.state.isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </motion.div>

          {/* End Session */}
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={voice.endSession}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Quick Actions */}
        {sessionType === 'full_board' && (
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowMemberSelect(true)}>
              Switch to 1:1
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrap with error boundary
export const VoiceBoardroom: React.FC<VoiceBoardroomProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Voice Session Error"
    fallbackMessage="The voice session encountered an error. Please try again."
  >
    <VoiceBoardroomContent {...props} />
  </BoardroomErrorBoundary>
);

export default VoiceBoardroom;
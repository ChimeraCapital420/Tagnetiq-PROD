// FILE: src/components/oracle/JarvisVoiceInterface.tsx (COMPLETE CONSOLIDATED VERSION)

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Brain, Zap, AlertCircle, Volume2, Settings } from 'lucide-react';
import { useStt } from '@/hooks/useStt';
import { useTts } from '@/hooks/useTts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { useOracleCommandHandler } from '@/lib/command-handler';

interface OpportunityAlert {
  type: 'personal-interest' | 'network-bounty' | 'trending-demand' | 'arbitrage';
  priority: 'low' | 'medium' | 'high' | 'critical';
  item: {
    description: string;
    estimatedValue?: { min: number; max: number };
  };
  voiceAlert: string;
}

export default function JarvisVoiceInterface() {
  const [isListening, setIsListening] = useState(false);
  const [currentMode, setCurrentMode] = useState<'sweep' | 'triage' | 'command'>('command');
  const [lastAlert, setLastAlert] = useState<OpportunityAlert | null>(null);
  const [isSweepActive, setIsSweepActive] = useState(false);
  const [opportunities, setOpportunities] = useState<OpportunityAlert[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  
  const { startListening, stopListening, isListening: sttActive } = useStt();
  const { speak, isSpeaking } = useTts();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const { handleVoiceCommand: handleOracleCommand } = useOracleCommandHandler();

  // Voice activation handler
  const handleVoiceActivation = useCallback(async () => {
    if (!isListening) {
      setIsListening(true);
      try {
        const result = await startListening();
        if (result?.transcript) {
          setTranscript(result.transcript);
          await processVoiceCommand(result.transcript);
        }
      } catch (error) {
        console.error('Voice recognition error:', error);
        toast.error(t('oracle.voice.recognitionError'));
      }
      setIsListening(false);
    } else {
      stopListening();
      setIsListening(false);
    }
  }, [isListening, startListening, stopListening, t]);

  // Process voice commands - CONSOLIDATED ALL FUNCTIONALITY
  const processVoiceCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    // Check if Oracle/TTS is enabled
    if (!profile?.settings?.tts_enabled) {
      toast.info(t('oracle.voice.notEnabled'));
      return;
    }

    // First, try the original Oracle command handler for existing commands
    const commandContext = {
      ...appContext,
      navigate,
      speak,
      voiceURI: profile?.settings?.tts_voice_uri || null,
    };
    
    // Check for existing Oracle commands (from GlobalVoiceControl functionality)
    const handled = await handleOracleCommand(command, commandContext);
    if (handled) return;
    
    // Scanner commands
    if (lowerCommand.includes('scan') || lowerCommand.includes('capture') || lowerCommand.includes('open scanner')) {
      appContext.setIsScannerOpen(true);
      speak(t('oracle.voice.scannerOpened', 'Scanner activated.'));
      return;
    }
    
    // Navigation commands
    if (lowerCommand.includes('go to') || lowerCommand.includes('navigate to')) {
      handleNavigationCommand(command);
      return;
    }
    
    // Jarvis-specific commands
    if (lowerCommand.includes('start sweep') || lowerCommand.includes('hunting mode')) {
      await startSweepMode();
    } else if (lowerCommand.includes('stop sweep')) {
      await stopSweepMode();
    } else if (lowerCommand.includes('triage')) {
      await performTriageCommand();
    } else if (lowerCommand.includes('deep dive') || lowerCommand.includes('analyze')) {
      await performDeepDive();
    } else if (lowerCommand.includes('vault') || lowerCommand.includes('save')) {
      await executeVaultCommand();
    } else if (lowerCommand.includes('help') || lowerCommand.includes('what can you do')) {
      speakHelp();
    } else {
      // Default response
      speak(t('oracle.voice.commandNotRecognized', 'I didn\'t understand that command. Say "help" for available commands.'));
    }
  };

  // Navigation handler
  const handleNavigationCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    const routes = {
      'dashboard': '/',
      'home': '/',
      'vault': '/vault',
      'profile': '/profile',
      'settings': '/profile?tab=oracle',
      'arena': '/arena',
      'marketplace': '/marketplace',
      'analysis': '/analysis'
    };
    
    for (const [keyword, route] of Object.entries(routes)) {
      if (lowerCommand.includes(keyword)) {
        navigate(route);
        speak(t('oracle.voice.navigating', `Navigating to ${keyword}.`));
        return;
      }
    }
  };

  const speakHelp = () => {
    const helpMessage = t('oracle.voice.help', `Available commands:
    - "Open scanner" to capture items
    - "Start sweep" for hunting mode
    - "Triage this" for quick evaluation
    - "Deep dive" for full analysis
    - "Vault this" to save items
    - "Go to vault" or other pages for navigation
    - "Stop sweep" to end hunting mode`);
    speak(helpMessage);
  };

  const startSweepMode = async () => {
    setCurrentMode('sweep');
    setIsSweepActive(true);
    speak(t('oracle.voice.sweepActivated', 'Sweep mode activated. I\'m now hunting for opportunities.'));
    
    // Start the sweep process
    try {
      const response = await fetch('/api/jarvis/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'continuous',
          interests: profile?.settings?.interests || []
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.match) {
          const alert: OpportunityAlert = {
            type: data.type,
            priority: data.priority,
            item: data.item,
            voiceAlert: data.nudgeMessage
          };
          setOpportunities(prev => [alert, ...prev.slice(0, 2)]);
          speak(alert.voiceAlert, { priority: 'high' });
        }
      }
    } catch (error) {
      console.error('Sweep error:', error);
    }
  };

  const stopSweepMode = async () => {
    setIsSweepActive(false);
    setCurrentMode('command');
    speak(t('oracle.voice.sweepDeactivated', 'Sweep mode deactivated. Standing by.'));
  };

  const performTriageCommand = async () => {
    setCurrentMode('triage');
    speak(t('oracle.voice.capturingImage', 'Capturing high-resolution image for triage...'));
    
    // Open scanner for image capture
    appContext.setIsScannerOpen(true);
    
    // The actual triage will happen when an image is captured
    // This is handled by the scanner component
  };

  const performDeepDive = async () => {
    if (!lastAlert && !appContext.lastScannedImage) {
      speak(t('oracle.voice.noItemForDeepDive', 'No item ready for analysis. Scan or triage an item first.'));
      return;
    }
    
    speak(t('oracle.voice.startingAnalysis', 'Initiating full Hydra analysis...'));
    
    // The analysis will be triggered through the scanner/analysis flow
    appContext.setIsScannerOpen(true);
  };

  const executeVaultCommand = async () => {
    if (!appContext.lastAnalysisResult) {
      speak(t('oracle.voice.noItemToVault', 'No analyzed item to vault. Analyze an item first.'));
      return;
    }
    
    // Navigate to vault with the item
    navigate('/vault?action=add');
    speak(t('oracle.voice.navigatingToVault', 'Opening vault to save your item.'));
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Support multiple shortcuts for different users
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') || // Ctrl+Shift+J
        ((e.ctrlKey || e.metaKey) && e.key === ' ') || // Ctrl+Space
        (e.shiftKey && e.code === 'Space') // Shift+Space
      ) {
        e.preventDefault();
        handleVoiceActivation();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleVoiceActivation]);

  const statusIcons = {
    sweep: <Zap className="w-4 h-4" />,
    triage: <Brain className="w-4 h-4" />,
    command: <Activity className="w-4 h-4" />
  };

  const priorityColors = {
    low: 'border-gray-500/50 bg-gray-500/10',
    medium: 'border-yellow-500/50 bg-yellow-500/10',
    high: 'border-orange-500/50 bg-orange-500/10',
    critical: 'border-red-500/50 bg-red-500/10'
  };

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <AnimatePresence>
        {/* Sweep Status Card */}
        {isSweepActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4"
          >
            <Card className="p-4 bg-black/90 backdrop-blur-xl border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-sm font-medium">{t('oracle.sweep.active')}</span>
                <Badge variant="outline" className="text-xs">
                  {opportunities.length} {t('oracle.sweep.found')}
                </Badge>
              </div>
              
              {opportunities.length > 0 && (
                <div className="space-y-2 mt-3">
                  {opportunities.map((opp, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-2 rounded border",
                        priorityColors[opp.priority]
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {opp.priority === 'critical' && (
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 text-xs">
                          <p className="font-medium">{opp.item.description}</p>
                          {opp.item.estimatedValue && (
                            <p className="text-muted-foreground mt-1">
                              ${opp.item.estimatedValue.min} - ${opp.item.estimatedValue.max}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Voice Transcript */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-xl rounded-lg p-3 max-w-xs"
          >
            <p className="text-sm">{transcript}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Voice Button */}
      <motion.button
        onClick={handleVoiceActivation}
        className={cn(
          "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
          isListening 
            ? "bg-red-500 shadow-lg shadow-red-500/50" 
            : "bg-primary shadow-lg shadow-primary/50 hover:scale-105"
        )}
        whileTap={{ scale: 0.95 }}
      >
        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
          </>
        )}
        
        {/* Mode indicator */}
        <div className="absolute -top-2 -right-2">
          <Badge 
            variant="secondary" 
            className="text-xs px-1.5 py-0.5"
          >
            {statusIcons[currentMode]}
          </Badge>
        </div>
        
        {/* Mic icon */}
        <motion.div
          className="relative z-10"
          animate={isListening ? { scale: [1, 0.9, 1] } : {}}
          transition={{ duration: 0.5, repeat: isListening ? Infinity : 0 }}
        >
          {isListening ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </motion.div>
      </motion.button>

      {/* Settings Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute -top-2 -left-14"
      >
        <Button
          size="icon"
          variant="ghost"
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm"
          onClick={() => navigate('/profile?tab=oracle')}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Volume2 className="w-3 h-3 animate-pulse" />
            {t('oracle.speaking')}
          </Badge>
        </div>
      )}
    </div>
  );
}
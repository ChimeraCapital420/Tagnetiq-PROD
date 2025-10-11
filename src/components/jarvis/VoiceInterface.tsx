// src/components/jarvis/VoiceInterface.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Brain, Zap, AlertCircle } from 'lucide-react';
import { useJarvis } from '../../hooks/useJarvis';
import { useStt } from '../../hooks/useStt';
import { useTts } from '../../hooks/useTts';
import { Badge } from '../ui/badge';

export default function JarvisVoiceInterface() {
  const [isListening, setIsListening] = useState(false);
  const [currentMode, setCurrentMode] = useState<'sweep' | 'triage' | 'command'>('sweep');
  const [lastAlert, setLastAlert] = useState<any>(null);
  
  const { 
    startSweep, 
    stopSweep, 
    performTriage, 
    executeCommand,
    isProcessing,
    sweepStatus,
    opportunities 
  } = useJarvis();
  
  const { startListening, stopListening, transcript } = useStt();
  const { speak, isSpeaking } = useTts();

  // Voice activation handler
  const handleVoiceActivation = useCallback(async () => {
    if (!isListening) {
      setIsListening(true);
      const result = await startListening();
      
      if (result.transcript) {
        await processVoiceCommand(result.transcript);
      }
      
      setIsListening(false);
    } else {
      stopListening();
      setIsListening(false);
    }
  }, [isListening, startListening, stopListening]);

  // Process voice commands
  const processVoiceCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    // Mode switching
    if (lowerCommand.includes('start sweep') || lowerCommand.includes('hunting mode')) {
      await startSweepMode();
    } else if (lowerCommand.includes('stop sweep')) {
      await stopSweepMode();
    } else if (lowerCommand.includes('triage')) {
      await performTriageCommand();
    } else if (lowerCommand.includes('deep dive')) {
      await performDeepDive();
    } else {
      // Execute general commands
      await executeJarvisCommand(command);
    }
  };

  const startSweepMode = async () => {
    setCurrentMode('sweep');
    await startSweep();
    speak("Sweep mode activated. I'm now hunting for opportunities. I'll alert you when I find something interesting.");
  };

  const stopSweepMode = async () => {
    await stopSweep();
    speak("Sweep mode deactivated. Standing by for your command.");
  };

  const performTriageCommand = async () => {
    setCurrentMode('triage');
    speak("Capturing high-resolution image for triage analysis...");
    
    const result = await performTriage();
    
    if (result.decision.action === 'deep-dive') {
      speak(result.voiceResponse);
      setLastAlert({ type: 'triage-positive', data: result });
    } else {
      speak(result.voiceResponse);
    }
    
    setCurrentMode('sweep');
  };

  const performDeepDive = async () => {
    if (!lastAlert || lastAlert.type !== 'triage-positive') {
      speak("No item ready for deep dive. Perform triage first.");
      return;
    }
    
    speak("Initiating full Hydra analysis. This will take about 30 seconds.");
    
    const result = await executeCommand({
      action: 'analyze',
      params: { fullAnalysis: true }
    });
    
    speak(`Analysis complete. ${result.summary}. Would you like me to vault this item?`);
  };

  const executeJarvisCommand = async (command: string) => {
    setCurrentMode('command');
    
    try {
      const result = await executeCommand(command);
      speak(result.voiceResponse);
    } catch (error) {
      speak("I couldn't process that command. Please try again.");
    }
    
    setCurrentMode('sweep');
  };

  // Handle opportunity alerts
  useEffect(() => {
    if (opportunities.length > 0) {
      const latestOpp = opportunities[0];
      
      if (latestOpp.priority === 'critical') {
        // Interrupt current activity for critical alerts
        speak(latestOpp.voiceAlert, { priority: 'high' });
        setLastAlert(latestOpp);
      } else if (!isSpeaking) {
        // Queue non-critical alerts
        speak(latestOpp.voiceAlert);
      }
    }
  }, [opportunities, speak, isSpeaking]);

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <AnimatePresence>
        {sweepStatus.isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 p-4 bg-black/90 backdrop-blur-xl rounded-lg border border-white/10"
          >
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-4 h-4 text-green-500 animate-pulse" />
              <span className="text-sm font-medium">Sweep Active</span>
              <Badge variant="outline" className="text-xs">
                {sweepStatus.itemsScanned} scanned
              </Badge>
            </div>
            
            {opportunities.length > 0 && (
              <div className="space-y-2 mt-3">
                {opportunities.slice(0, 3).map((opp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-2 rounded border ${
                      opp.priority === 'critical' 
                        ? 'border-red-500/50 bg-red-500/10' 
                        : 'border-yellow-500/50 bg-yellow-500/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {opp.priority === 'critical' && (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 text-xs">
                        <p className="font-medium">{opp.item.description}</p>
                        {opp.networkContext && (
                          <p className="text-muted-foreground mt-1">
                            {opp.networkContext.interestedUsers} interested • 
                            {opp.networkContext.bountyValue && ` $${opp.networkContext.bountyValue} bounty`}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Voice Button */}
      <motion.button
        onClick={handleVoiceActivation}
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          ${isListening 
            ? 'bg-red-500 shadow-lg shadow-red-500/50' 
            : 'bg-primary shadow-lg shadow-primary/50'
          }
          transition-all duration-300
        `}
        whileHover={{ scale: 1.05 }}
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
            {currentMode === 'sweep' && <Zap className="w-3 h-3" />}
            {currentMode === 'triage' && <Brain className="w-3 h-3" />}
            {currentMode === 'command' && <Activity className="w-3 h-3" />}
          </Badge>
        </div>
        
        {/* Mic icon */}
        <motion.div
          animate={isListening ? { scale: [1, 0.9, 1] } : {}}
          transition={{ duration: 0.5, repeat: isListening ? Infinity : 0 }}
        >
          {isListening ? (
            <MicOff className="w-6 h-6 text-white relative z-10" />
          ) : (
            <Mic className="w-6 h-6 text-white relative z-10" />
          )}
        </motion.div>
      </motion.button>

      {/* Voice transcript */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-xl rounded-lg p-2 max-w-xs"
          >
            <p className="text-sm">{transcript}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
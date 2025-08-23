// FILE: src/lib/command-handler.ts

import { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';

// The context now includes the TTS speak function and new action dispatchers
interface CommandContext {
  setIsScannerOpen: (isOpen: boolean) => void;
  startScanWithCategory: (categoryId: string, subcategoryId: string | null) => void;
  setSearchArenaQuery: (query: string) => void;
  navigate: NavigateFunction;
  speak: (text: string, voiceURI?: string | null) => void;
  voiceURI: string | null;
}

interface OracleResponse {
  intent: 'SEARCH_ARENA' | 'INITIATE_SCAN' | 'NAVIGATE' | 'UNKNOWN';
  parameters: any;
  feedback_phrase: string;
}

export const handleVoiceCommand = async (command: string, context: CommandContext) => {
  console.log(`Received command: "${command}"`);

  // --- Fast Path for Simple Commands ---
  if (command.includes('open vault')) {
    context.speak('Opening your Vault.', context.voiceURI);
    context.navigate('/vault');
    return;
  }
  if (command.includes('go home') || command.includes('open dashboard')) {
    context.speak('Navigating to your dashboard.', context.voiceURI);
    context.navigate('/dashboard');
    return;
  }

  // --- NLU Path for Complex Commands ---
  try {
    const response = await fetch('/api/oracle/interpret-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      throw new Error('The Oracle is not responding.');
    }

    const data: OracleResponse = await response.json();
    
    // Speak the feedback phrase first
    context.speak(data.feedback_phrase, context.voiceURI);

    // Execute action based on intent
    switch (data.intent) {
      case 'SEARCH_ARENA':
        context.setSearchArenaQuery(data.parameters.query);
        context.navigate('/arena/marketplace');
        break;
      
      case 'INITIATE_SCAN':
        context.startScanWithCategory(data.parameters.category_id, data.parameters.subcategory_id);
        break;

      case 'NAVIGATE':
        context.navigate(`/${data.parameters.destination}`);
        break;

      case 'UNKNOWN':
        // The feedback phrase already handled the user notification. No further action needed.
        break;
        
      default:
        toast.warning('Received an unknown intent from the Oracle.');
    }

  } catch (error) {
    const message = (error as Error).message;
    toast.error('Voice command failed', { description: message });
    context.speak(`Sorry, there was an error processing your command: ${message}`, context.voiceURI);
  }
};
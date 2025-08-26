// FILE: src/lib/command-handler.ts

import { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from './supabase';

// --- SYSTEM 1: OLD SCANNER-SPECIFIC COMMANDS (Restored for DualScanner) ---

interface SimpleCommandActions {
    onScan: () => void;
    onClose: () => void;
}

const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): void => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

const debouncedMarketSearch = debounce(async (query: string) => {
    try {
        const { data, error } = await supabase
            .from('marketplace_listings')
            .select('item_name, challenge_id')
            .textSearch('fts', query, { type: 'websearch' })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            toast.success(`Found "${data[0].item_name}". Navigating now...`);
            window.location.href = `/arena/challenge/${data[0].challenge_id}`;
        } else {
            toast.info(`No direct match found for "${query}". Broadening search.`);
            window.location.href = `/arena/marketplace?search=${encodeURIComponent(query)}`;
        }
    } catch (err) {
        toast.error('Error searching marketplace', { description: (err as Error).message });
    }
}, 500);

// This function is required by the useStt hook, which is used by DualScanner.
export const processVoiceCommand = (command: string, actions: SimpleCommandActions) => {
    const lowerCommand = command.toLowerCase();
    console.log("Processing simple command:", lowerCommand);
    toast.info(`Command heard: "${command}"`);

    if (lowerCommand.includes("scan") || lowerCommand.includes("analyze")) {
        actions.onScan();
    } else if (lowerCommand.includes("close") || lowerCommand.includes("cancel")) {
        actions.onClose();
    } else if (lowerCommand.startsWith("search for")) {
        const query = lowerCommand.replace("search for", "").trim();
        if (query) {
            toast.info(`Searching marketplace for: "${query}"...`);
            debouncedMarketSearch(query);
        } else {
            toast.warning("Search command heard, but no item was specified.");
        }
    } else {
        toast.warning("Command not recognized", { description: "Try 'Scan', 'Close', or 'Search for [item]'."});
    }
};


// --- SYSTEM 2: NEW ORACLE-BASED GLOBAL COMMANDS (Your existing code) ---

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

// This function is used by the new global voice control feature.
export const handleVoiceCommand = async (command: string, context: CommandContext) => {
  console.log(`Received command for Oracle: "${command}"`);

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
    
    context.speak(data.feedback_phrase, context.voiceURI);

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
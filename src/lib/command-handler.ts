// FILE: src/lib/command-handler.ts
// STATUS: Surgically updated for multilingual NLU. No other functions were altered.

import { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from './supabase';
// --- ORACLE SURGICAL ADDITION ---
// Import useTranslation to access the current language.
import { useTranslation } from 'react-i18next';

// --- SYSTEM 1: OLD SCANNER-SPECIFIC COMMANDS (Unaffected by this operation) ---

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


// --- SYSTEM 2: NEW ORACLE-BASED GLOBAL COMMANDS (Surgically Updated) ---

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

export const useOracleCommandHandler = () => {
    // --- ORACLE SURGICAL ADDITION ---
    // The i18n instance is brought into the scope of the command handler.
    const { i18n } = useTranslation();

    const handleVoiceCommand = async (command: string, context: CommandContext) => {
        console.log(`Received command for Oracle: "${command}" in language "${i18n.language}"`);

        // Fast path checks remain untouched.
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
                // --- ORACLE SURGICAL ADDITION ---
                // The user's current language is now sent with the command.
                // This instructs the NLU model to interpret the command in the correct language
                // and to generate the feedback_phrase in that same language.
                body: JSON.stringify({ command, language: i18n.language }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Oracle API Error Response:", errorBody);
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
    
    // The hook now returns the configured handler function.
    return { handleVoiceCommand };
};

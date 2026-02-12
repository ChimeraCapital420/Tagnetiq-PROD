// FILE: src/lib/oracle/command-router.ts
// Oracle Phase 1 — Client-side command routing with API fallback
// REPLACES: src/lib/command-handler.ts (which had two conflicting systems crammed together)
//
// ARCHITECTURE:
//   1. Fast-path: Pattern match common commands client-side (~0ms)
//   2. Slow-path: Only hit /api/oracle/interpret-command for ambiguous input (~800ms)
//   This saves ~500ms per command and reduces API costs by ~80%
//
// Mobile-first: All processing on-device when possible

import { NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export type OracleIntent =
  | 'SCAN'
  | 'SEARCH_ARENA'
  | 'NAVIGATE'
  | 'VAULT_SAVE'
  | 'HELP'
  | 'UNKNOWN';

export interface OracleCommand {
  intent: OracleIntent;
  parameters: Record<string, string | null>;
  feedback: string;
  source: 'client' | 'api';
}

export interface OracleContext {
  setIsScannerOpen: (isOpen: boolean) => void;
  startScanWithCategory: (categoryId: string, subcategoryId: string | null) => void;
  setSearchArenaQuery: (query: string) => void;
  navigate: NavigateFunction;
  speak: (text: string, voiceURI?: string | null, premiumVoiceId?: string | null) => void;
  voiceURI: string | null;
  premiumVoiceId?: string | null;
  hasAnalysisResult: boolean;
}

// =============================================================================
// CLIENT-SIDE PATTERN MATCHING (fast path)
// =============================================================================

const NAV_ROUTES: Record<string, string> = {
  'dashboard': '/',
  'home': '/',
  'vault': '/vault',
  'profile': '/profile',
  'settings': '/profile?tab=oracle',
  'arena': '/arena',
  'marketplace': '/arena/marketplace',
};

// Category mapping for scan commands
const SCAN_CATEGORIES: Record<string, { categoryId: string; subcategoryId: string | null }> = {
  'coin': { categoryId: 'collectibles', subcategoryId: 'collectibles-coins' },
  'coins': { categoryId: 'collectibles', subcategoryId: 'collectibles-coins' },
  'stamp': { categoryId: 'collectibles', subcategoryId: 'collectibles-stamps' },
  'stamps': { categoryId: 'collectibles', subcategoryId: 'collectibles-stamps' },
  'card': { categoryId: 'collectibles', subcategoryId: 'collectibles-tradingcards' },
  'cards': { categoryId: 'collectibles', subcategoryId: 'collectibles-tradingcards' },
  'pokemon': { categoryId: 'collectibles', subcategoryId: 'collectibles-tradingcards' },
  'comic': { categoryId: 'collectibles', subcategoryId: 'collectibles-comics' },
  'comics': { categoryId: 'collectibles', subcategoryId: 'collectibles-comics' },
  'toy': { categoryId: 'collectibles', subcategoryId: 'collectibles-toys' },
  'toys': { categoryId: 'collectibles', subcategoryId: 'collectibles-toys' },
  'lego': { categoryId: 'lego', subcategoryId: 'lego-set' },
  'watch': { categoryId: 'luxury-goods', subcategoryId: 'luxury-watches' },
  'watches': { categoryId: 'luxury-goods', subcategoryId: 'luxury-watches' },
  'handbag': { categoryId: 'luxury-goods', subcategoryId: 'luxury-handbags' },
  'jewelry': { categoryId: 'luxury-goods', subcategoryId: 'luxury-jewelry' },
  'art': { categoryId: 'luxury-goods', subcategoryId: 'luxury-art' },
  'star wars': { categoryId: 'starwars', subcategoryId: 'starwars-figures' },
  'vinyl': { categoryId: 'books-and-media', subcategoryId: 'books-vinyl' },
  'record': { categoryId: 'books-and-media', subcategoryId: 'books-vinyl' },
  'book': { categoryId: 'books-and-media', subcategoryId: 'books-firstedition' },
  'books': { categoryId: 'books-and-media', subcategoryId: 'books-firstedition' },
  'video game': { categoryId: 'books-and-media', subcategoryId: 'books-videogames' },
  'jersey': { categoryId: 'sports-memorabilia', subcategoryId: 'sports-jerseys' },
  'sports card': { categoryId: 'sports-memorabilia', subcategoryId: 'sports-cards' },
  'autograph': { categoryId: 'sports-memorabilia', subcategoryId: 'sports-autographs' },
  'car': { categoryId: 'vehicles', subcategoryId: 'vehicles-value' },
  'vehicle': { categoryId: 'vehicles', subcategoryId: 'vehicles-value' },
  'house': { categoryId: 'real-estate', subcategoryId: 'real-estate-comps' },
  'property': { categoryId: 'real-estate', subcategoryId: 'real-estate-comps' },
};

/**
 * Attempt to classify a voice command purely on-device.
 * Returns null if the command is ambiguous and needs API classification.
 */
function classifyLocally(raw: string): OracleCommand | null {
  const cmd = raw.toLowerCase().trim();

  // ── SCAN ──────────────────────────────────────────────────
  if (
    cmd.includes('scan') ||
    cmd.includes('capture') ||
    cmd.includes('open scanner') ||
    cmd.includes('open camera') ||
    cmd === 'what is this' ||
    cmd === 'what\'s this' ||
    cmd === 'what\'s this worth' ||
    cmd === 'what is this worth'
  ) {
    // Check if user specified a category
    for (const [keyword, cat] of Object.entries(SCAN_CATEGORIES)) {
      if (cmd.includes(keyword)) {
        return {
          intent: 'SCAN',
          parameters: { categoryId: cat.categoryId, subcategoryId: cat.subcategoryId },
          feedback: `Scanning for ${keyword}.`,
          source: 'client',
        };
      }
    }
    return {
      intent: 'SCAN',
      parameters: { categoryId: '', subcategoryId: null },
      feedback: 'Scanner activated.',
      source: 'client',
    };
  }

  // ── SEARCH ────────────────────────────────────────────────
  const searchPrefixes = ['search for ', 'search the arena for ', 'find ', 'look for ', 'search '];
  for (const prefix of searchPrefixes) {
    if (cmd.startsWith(prefix)) {
      const query = cmd.slice(prefix.length).trim();
      if (query) {
        return {
          intent: 'SEARCH_ARENA',
          parameters: { query },
          feedback: `Searching the Arena for ${query}.`,
          source: 'client',
        };
      }
    }
  }

  // ── NAVIGATE ──────────────────────────────────────────────
  const navPrefixes = ['go to ', 'navigate to ', 'open ', 'take me to ', 'show me '];
  for (const prefix of navPrefixes) {
    if (cmd.startsWith(prefix)) {
      const destination = cmd.slice(prefix.length).trim();
      for (const [keyword, route] of Object.entries(NAV_ROUTES)) {
        if (destination.includes(keyword)) {
          return {
            intent: 'NAVIGATE',
            parameters: { destination: route },
            feedback: `Navigating to ${keyword}.`,
            source: 'client',
          };
        }
      }
    }
  }
  // Direct keyword navigation (no prefix)
  if (cmd === 'vault' || cmd === 'open vault') {
    return { intent: 'NAVIGATE', parameters: { destination: '/vault' }, feedback: 'Opening your Vault.', source: 'client' };
  }
  if (cmd === 'home' || cmd === 'go home' || cmd === 'dashboard' || cmd === 'open dashboard') {
    return { intent: 'NAVIGATE', parameters: { destination: '/' }, feedback: 'Navigating to your dashboard.', source: 'client' };
  }

  // ── VAULT SAVE ────────────────────────────────────────────
  if (cmd.includes('vault this') || cmd.includes('save this') || cmd.includes('save to vault')) {
    return {
      intent: 'VAULT_SAVE',
      parameters: {},
      feedback: 'Opening vault to save your item.',
      source: 'client',
    };
  }

  // ── HELP ──────────────────────────────────────────────────
  if (cmd === 'help' || cmd.includes('what can you do') || cmd.includes('commands')) {
    return {
      intent: 'HELP',
      parameters: {},
      feedback: 'I can scan items, search the arena, navigate the app, and save to your vault. Just tell me what you need.',
      source: 'client',
    };
  }

  // Not confident enough — fall through to API
  return null;
}

// =============================================================================
// API FALLBACK (slow path)
// =============================================================================

async function classifyViaAPI(command: string, language: string): Promise<OracleCommand> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch('/api/oracle/interpret-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ command, language }),
    });

    if (!response.ok) {
      throw new Error('Oracle API error');
    }

    const data = await response.json();

    // Map API intent names to our local intent names
    const intentMap: Record<string, OracleIntent> = {
      'SEARCH_ARENA': 'SEARCH_ARENA',
      'INITIATE_SCAN': 'SCAN',
      'NAVIGATE': 'NAVIGATE',
      'UNKNOWN': 'UNKNOWN',
    };

    return {
      intent: intentMap[data.intent] || 'UNKNOWN',
      parameters: data.parameters || {},
      feedback: data.feedback_phrase || '',
      source: 'api',
    };
  } catch (error) {
    console.error('Oracle API fallback error:', error);
    return {
      intent: 'UNKNOWN',
      parameters: {},
      feedback: "Sorry, I couldn't process that command. Try saying 'help' for available commands.",
      source: 'api',
    };
  }
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

function executeCommand(command: OracleCommand, ctx: OracleContext): void {
  // Speak the feedback
  ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);

  switch (command.intent) {
    case 'SCAN':
      if (command.parameters.categoryId) {
        ctx.startScanWithCategory(
          command.parameters.categoryId,
          command.parameters.subcategoryId || null,
        );
      } else {
        ctx.setIsScannerOpen(true);
      }
      break;

    case 'SEARCH_ARENA':
      if (command.parameters.query) {
        ctx.setSearchArenaQuery(command.parameters.query);
        ctx.navigate('/arena/marketplace');
      }
      break;

    case 'NAVIGATE':
      if (command.parameters.destination) {
        ctx.navigate(command.parameters.destination);
      }
      break;

    case 'VAULT_SAVE':
      if (ctx.hasAnalysisResult) {
        ctx.navigate('/vault?action=add');
      } else {
        ctx.speak('No analyzed item to save. Scan something first.', ctx.voiceURI, ctx.premiumVoiceId);
      }
      break;

    case 'HELP':
      // Feedback already spoken above
      break;

    case 'UNKNOWN':
      // Feedback already spoken above
      break;
  }
}

// =============================================================================
// PUBLIC API — Main entry point
// =============================================================================

/**
 * Route a voice command: try client-side first, fall back to API.
 * This is the only function the OracleVoiceButton needs to call.
 */
export async function routeCommand(
  rawCommand: string,
  language: string,
  ctx: OracleContext,
): Promise<OracleCommand> {
  console.log(`🔮 Oracle routing: "${rawCommand}" (${language})`);

  // Try fast path first
  const localResult = classifyLocally(rawCommand);

  if (localResult) {
    console.log(`⚡ Client-side match: ${localResult.intent}`, localResult.parameters);
    executeCommand(localResult, ctx);
    return localResult;
  }

  // Fall back to API
  console.log('🌐 No client match — calling Oracle API...');
  const apiResult = await classifyViaAPI(rawCommand, language);
  console.log(`📡 API result: ${apiResult.intent}`, apiResult.parameters);
  executeCommand(apiResult, ctx);
  return apiResult;
}
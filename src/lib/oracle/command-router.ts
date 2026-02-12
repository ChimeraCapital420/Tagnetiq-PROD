// FILE: src/lib/oracle/command-router.ts
// Oracle Phase 2 — Client-side command routing with chat fallback
// FIXED: "what have I scanned" no longer opens camera (was: cmd.includes('scan'))
// FIXED: Conversational input ("hey", questions, etc.) now routes to chat API
//        instead of returning cold UNKNOWN rejection
//
// ARCHITECTURE:
//   1. Fast-path: Pattern match COMMANDS client-side (~0ms)
//   2. Conversation: Detect non-command input → route to /api/oracle/chat (~1s)
//   3. Slow-path: Ambiguous input → /api/oracle/interpret-command (~800ms)

import { NavigateFunction } from 'react-router-dom';
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
  | 'CONVERSATION'
  | 'UNKNOWN';

export interface OracleCommand {
  intent: OracleIntent;
  parameters: Record<string, string | null>;
  feedback: string;
  source: 'client' | 'api' | 'chat';
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
  'arena': '/arena/marketplace',
  'marketplace': '/arena/marketplace',
  'oracle': '/oracle',
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

// ── SCAN detection (word-boundary aware) ────────────────────
// Must be an ACTION verb, not past tense or part of a question
const SCAN_ACTION_PATTERNS = [
  /^scan\b/,                    // "scan this", "scan my coin"
  /\bscan (this|that|it)\b/,   // "please scan this"
  /\bopen (the\s+)?scanner\b/, // "open scanner", "open the scanner"
  /\bopen (the\s+)?camera\b/,  // "open camera"
  /\bcapture\b/,               // "capture this"
  /^what is this$/,            // exact match
  /^what's this$/,             // exact match
  /^what's this worth$/,       // exact match
  /^what is this worth$/,      // exact match
  /\bstart scan/,              // "start scanning"
];

// Words that indicate a QUESTION about scanning, not a scan command
const SCAN_QUESTION_PATTERNS = [
  /\bscanned\b/,               // "what have I scanned" — past tense
  /\bscanning\b.*\?/,          // "what am I scanning?" — question about scanning
  /\bmy scan/,                 // "show me my scans", "my scan history"
  /\bscan history/,            // "scan history"
  /\bhow many.*scan/,          // "how many scans"
  /\blast scan/,               // "my last scan"
  /\bbest scan/,               // "my best scan"
  /\brecent scan/,             // "recent scans"
];

// ── CONVERSATION detection ──────────────────────────────────
// These should go to the chat API, not the command router
const CONVERSATION_PATTERNS = [
  /^(hey|hi|hello|yo|sup|howdy|hola|what's up|whats up)\b/,
  /^(how are you|how's it going|good morning|good evening)/,
  /^(what|who|when|where|why|how|tell me|explain|describe|show me)\b/,
  /\?$/,                       // Anything ending in a question mark
  /^(thanks|thank you|thx|ty)\b/,
  /^(I |my |me |we |our )/i,  // Personal statements: "I found...", "my collection..."
  /\b(worth|value|valuable|expensive|cheap|price|cost)\b.*\?/,  // Value questions
  /\b(should I|do you think|what do you|can you)\b/,
  /\b(recommend|suggest|advice|opinion|think about)\b/,
  /\b(trending|popular|hot|market|flip)\b/,
];

/**
 * Attempt to classify a voice command purely on-device.
 * Returns null if the command is ambiguous and needs API classification.
 */
function classifyLocally(raw: string): OracleCommand | null {
  const cmd = raw.toLowerCase().trim();

  // ── CONVERSATION CHECK FIRST ────────────────────────────
  // If this looks like conversation/question, route to chat
  for (const pattern of CONVERSATION_PATTERNS) {
    if (pattern.test(cmd)) {
      return {
        intent: 'CONVERSATION',
        parameters: { message: raw }, // Preserve original casing
        feedback: '', // Chat API will provide the response
        source: 'client',
      };
    }
  }

  // ── SCAN QUESTION CHECK ─────────────────────────────────
  // "What have I scanned" should NOT open camera
  for (const pattern of SCAN_QUESTION_PATTERNS) {
    if (pattern.test(cmd)) {
      return {
        intent: 'CONVERSATION',
        parameters: { message: raw },
        feedback: '',
        source: 'client',
      };
    }
  }

  // ── SCAN COMMAND ────────────────────────────────────────
  let isScanCommand = false;
  for (const pattern of SCAN_ACTION_PATTERNS) {
    if (pattern.test(cmd)) {
      isScanCommand = true;
      break;
    }
  }

  if (isScanCommand) {
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
  const searchPrefixes = ['search for ', 'search the arena for ', 'find me ', 'look for ', 'search '];
  for (const prefix of searchPrefixes) {
    if (cmd.startsWith(prefix)) {
      const query = cmd.slice(prefix.length).trim();
      if (query && query.length > 1) {
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
        if (destination === keyword || destination === `the ${keyword}` || destination === `my ${keyword}`) {
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
  // Direct keyword navigation
  if (cmd === 'vault' || cmd === 'open vault' || cmd === 'my vault') {
    return { intent: 'NAVIGATE', parameters: { destination: '/vault' }, feedback: 'Opening your Vault.', source: 'client' };
  }
  if (cmd === 'home' || cmd === 'go home' || cmd === 'dashboard' || cmd === 'open dashboard') {
    return { intent: 'NAVIGATE', parameters: { destination: '/' }, feedback: 'Navigating home.', source: 'client' };
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
  if (cmd === 'help' || cmd === 'commands' || cmd === 'what can you do') {
    return {
      intent: 'HELP',
      parameters: {},
      feedback: 'I can scan items, search the arena, navigate the app, and save to your vault. You can also just talk to me — ask about your scans, market trends, or anything resale related.',
      source: 'client',
    };
  }

  // ── DEFAULT: Treat as conversation ────────────────────────
  // Instead of returning UNKNOWN with a cold rejection,
  // route EVERYTHING unrecognized to the chat API
  return {
    intent: 'CONVERSATION',
    parameters: { message: raw },
    feedback: '',
    source: 'client',
  };
}

// =============================================================================
// CHAT API CALL (for conversational input)
// =============================================================================

async function chatWithOracle(message: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "I need you to be logged in to chat. Try again after signing in.";

    const response = await fetch('/api/oracle/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        conversationHistory: [], // Voice chat doesn't persist history (use Oracle page for that)
      }),
    });

    if (!response.ok) throw new Error('Chat API error');

    const data = await response.json();
    return data.response || "Sorry, I couldn't think of a response. Try again.";

  } catch (error) {
    console.error('Oracle chat error:', error);
    return "I had a little trouble there. Try asking again, or open the Oracle page for a full conversation.";
  }
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

async function executeCommand(command: OracleCommand, ctx: OracleContext): Promise<void> {
  switch (command.intent) {
    case 'CONVERSATION': {
      // Route to chat API — get a warm, contextual response
      const message = command.parameters.message || '';
      console.log(`💬 Routing to Oracle chat: "${message}"`);
      const chatResponse = await chatWithOracle(message);
      ctx.speak(chatResponse, ctx.voiceURI, ctx.premiumVoiceId);
      // Update the command feedback for any UI that wants it
      command.feedback = chatResponse;
      break;
    }

    case 'SCAN':
      ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);
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
      ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);
      if (command.parameters.query) {
        ctx.setSearchArenaQuery(command.parameters.query);
        ctx.navigate('/arena/marketplace');
      }
      break;

    case 'NAVIGATE':
      ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);
      if (command.parameters.destination) {
        ctx.navigate(command.parameters.destination);
      }
      break;

    case 'VAULT_SAVE':
      if (ctx.hasAnalysisResult) {
        ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);
        ctx.navigate('/vault?action=add');
      } else {
        ctx.speak('No analyzed item to save. Scan something first.', ctx.voiceURI, ctx.premiumVoiceId);
      }
      break;

    case 'HELP':
      ctx.speak(command.feedback, ctx.voiceURI, ctx.premiumVoiceId);
      break;

    case 'UNKNOWN':
      // This should rarely hit now — most things route to CONVERSATION
      const fallbackResponse = await chatWithOracle(command.parameters.message || 'hello');
      ctx.speak(fallbackResponse, ctx.voiceURI, ctx.premiumVoiceId);
      command.feedback = fallbackResponse;
      break;
  }
}

// =============================================================================
// PUBLIC API — Main entry point
// =============================================================================

/**
 * Route a voice command: classify client-side, execute or chat.
 * No more cold UNKNOWN rejections — everything gets a warm response.
 */
export async function routeCommand(
  rawCommand: string,
  language: string,
  ctx: OracleContext,
): Promise<OracleCommand> {
  console.log(`🔮 Oracle routing: "${rawCommand}" (${language})`);

  const result = classifyLocally(rawCommand);

  if (result) {
    console.log(`⚡ Classified: ${result.intent}`, result.parameters);
    await executeCommand(result, ctx);
    return result;
  }

  // This shouldn't happen since classifyLocally always returns something now,
  // but just in case — route to conversation
  const fallback: OracleCommand = {
    intent: 'CONVERSATION',
    parameters: { message: rawCommand },
    feedback: '',
    source: 'client',
  };
  await executeCommand(fallback, ctx);
  return fallback;
}
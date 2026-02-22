// FILE: src/lib/oracle/narrator/templates.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — Template-Driven Commentary System
// ═══════════════════════════════════════════════════════════════════════
// Zero LLM calls. Sub-millisecond. 100% client-side.
//
// Templates are keyed by category + event type.
// Seeded random selection: same item → same template within session.
// Persona-aware: estate persona gets softer language.
//
// Event types:
//   - item_identified:            First identification during scan
//   - analysis_complete_clean:    All models agree, no discrepancies
//   - analysis_complete_interesting: Discrepancies found, outliers detected
//
// Categories: coins, comics, cards, electronics, fashion, pyrex,
//             toys, art, general (+ catchall)
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export type NarratorEventType =
  | 'item_identified'
  | 'analysis_complete_clean'
  | 'analysis_complete_interesting';

export interface NarratorContext {
  eventType: NarratorEventType;
  itemName: string;
  category: string;
  voteCount?: number;
  consensusValue?: number;
  outlierProvider?: string;
  outlierValue?: number;
  highProvider?: string;
  highValue?: number;
  lowProvider?: string;
  lowValue?: number;
  persona?: 'default' | 'estate' | 'hustle' | 'collector';
}

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

const TEMPLATES: Record<string, Record<NarratorEventType, string[]>> = {
  coins: {
    item_identified: [
      '{itemName}? Interesting. Let me pull the authority data on that...',
      'A coin — {itemName}. Running it through the grading models now...',
      '{itemName}. Let me check the mint records and recent auction data...',
    ],
    analysis_complete_clean: [
      'Solid numismatic find. {voteCount} models agree on this one.',
      'Pretty clear picture — ${consensusValue}, and the models are aligned.',
      'The AI consensus on {itemName} looks tight. Good data here.',
    ],
    analysis_complete_interesting: [
      'Hmm — {outlierProvider} thinks this is worth ${outlierValue} while consensus says ${consensusValue}. Could be a grading disagreement.',
      'The models split on this coin. {highProvider} sees ${highValue} but {lowProvider} says ${lowValue}. Worth checking condition closely.',
      'Interesting spread. Coin valuations can swing hard on grade. Tap the reports to see each model\'s reasoning.',
    ],
  },

  comics: {
    item_identified: [
      'Oh, {itemName} — let me check what the market says about that one...',
      '{itemName}! Running it through the comic database now...',
      'A comic — {itemName}. Let me pull CGC data and recent sales...',
    ],
    analysis_complete_clean: [
      '{voteCount} models align on {itemName}. Clean consensus.',
      'The market data backs this up — ${consensusValue} looks right.',
      'Strong agreement across the board. The comic market is pretty well-documented.',
    ],
    analysis_complete_interesting: [
      '{outlierProvider} sees something the others don\'t on {itemName}. Worth investigating.',
      'Split opinion — could be a key issue debate or condition question. {highProvider} at ${highValue} vs {lowProvider} at ${lowValue}.',
      'The models disagree here. Comics can vary wildly based on print run and condition. Check the individual reports.',
    ],
  },

  cards: {
    item_identified: [
      '{itemName} — let me check the card databases...',
      'A card! {itemName}. Running through pricing models now...',
      '{itemName}. Pulling comp data from recent sales...',
    ],
    analysis_complete_clean: [
      'Clean read — {voteCount} models agree at ${consensusValue}.',
      'The card market has solid data for {itemName}. Models aligned.',
      'Good consensus. Card pricing is well-tracked these days.',
    ],
    analysis_complete_interesting: [
      'Grading matters big here. {highProvider} sees ${highValue} — could be assuming a higher grade than {lowProvider} at ${lowValue}.',
      'Spread on this card. Could be a version or print difference the models are seeing differently.',
      '{outlierProvider} came in different at ${outlierValue}. Might be worth getting a second look.',
    ],
  },

  pokemon_cards: {
    item_identified: [
      '{itemName} — let me check the Pokémon card databases...',
      'A Pokémon card! {itemName}. Pulling TCGPlayer and PSA data...',
      '{itemName}. Running through the card pricing models now...',
    ],
    analysis_complete_clean: [
      'Clean read — {voteCount} models agree at ${consensusValue}.',
      'Models aligned on {itemName}. Card market data is solid here.',
      'Good consensus across the board.',
    ],
    analysis_complete_interesting: [
      'Grade matters a LOT here. {highProvider} at ${highValue} vs {lowProvider} at ${lowValue} — could be a PSA grade assumption.',
      'The models split on this one. Edition and centering can swing Pokémon card values significantly.',
      '{outlierProvider} sees ${outlierValue}. Could be pricing a different variant.',
    ],
  },

  trading_cards: {
    item_identified: [
      '{itemName} — checking card databases...',
      'Trading card: {itemName}. Running comps now...',
      '{itemName}. Let me pull recent sale data...',
    ],
    analysis_complete_clean: [
      'Solid data on this one. {voteCount} models agree.',
      'Clean consensus at ${consensusValue}.',
      'The models are aligned. Good market data available.',
    ],
    analysis_complete_interesting: [
      'Split opinion — condition or variant differences could explain the spread.',
      '{highProvider} at ${highValue} vs {lowProvider} at ${lowValue}. Worth checking the details.',
      'The models disagree. Tap the reports to understand why.',
    ],
  },

  electronics: {
    item_identified: [
      '{itemName} — checking the resale market on that...',
      'Electronics find: {itemName}. Let me check current prices...',
      '{itemName}. Running it through the models — electronics depreciate fast, let me get you current data.',
    ],
    analysis_complete_clean: [
      'Good news — {voteCount} models agree on ${consensusValue}.',
      'Clean consensus on {itemName}. Electronics pricing is pretty transparent.',
      'Models aligned. The resale value looks solid for its age.',
    ],
    analysis_complete_interesting: [
      'The models disagree — could be condition, firmware version, or accessories included.',
      '{outlierProvider} sees ${outlierValue} vs consensus of ${consensusValue}. Might factor in different conditions.',
      'Spread here. Electronics values can swing based on model year and included accessories.',
    ],
  },

  fashion: {
    item_identified: [
      '{itemName} — let me check the fashion resale platforms...',
      'Fashion piece: {itemName}. Running authentication and pricing...',
      '{itemName}. Checking current market value across platforms...',
    ],
    analysis_complete_clean: [
      'Models agree on {itemName}. ${consensusValue} looks right for the current market.',
      'Clean consensus — fashion resale data backs this up.',
      '{voteCount} models aligned. Good find.',
    ],
    analysis_complete_interesting: [
      'Authentication matters here. {highProvider} at ${highValue} — could be assuming verified authentic.',
      'Split on this piece. Fashion resale values depend heavily on authentication and condition.',
      'The models disagree. Could be a rarity or condition question. Check the individual reports.',
    ],
  },

  pyrex: {
    item_identified: [
      '{itemName} — let me check the Pyrex collector market...',
      'Ooh, Pyrex! {itemName}. Pulling collector pricing...',
      '{itemName}. The Pyrex market has been hot — let me get you numbers.',
    ],
    analysis_complete_clean: [
      'Nice find! {voteCount} models agree at ${consensusValue}.',
      'Clean consensus on the Pyrex. The collector market has solid data.',
      'Models aligned. Pyrex collectors know what they want.',
    ],
    analysis_complete_interesting: [
      'Pattern and condition are everything with Pyrex. {highProvider} at ${highValue} vs {lowProvider} at ${lowValue}.',
      'The models split — could be a color/pattern identification difference.',
      '{outlierProvider} sees something different at ${outlierValue}. Check if it\'s a rare pattern variation.',
    ],
  },

  toys: {
    item_identified: [
      '{itemName} — checking toy collector databases...',
      'A toy: {itemName}. Let me check what collectors are paying...',
      '{itemName}. Running through the models — toy values can surprise you.',
    ],
    analysis_complete_clean: [
      'Clean consensus — {voteCount} models at ${consensusValue}.',
      'Models agree on {itemName}. Good collector data available.',
      'Solid agreement. The toy market data backs this up.',
    ],
    analysis_complete_interesting: [
      'Completeness matters — {highProvider} at ${highValue} might be assuming original box and accessories.',
      'The models split. Toy values vary wildly based on completeness and condition.',
      '{outlierProvider} sees ${outlierValue}. Could be a variant or packaging difference.',
    ],
  },

  art: {
    item_identified: [
      '{itemName} — let me research this piece...',
      'Art piece: {itemName}. Running it through authentication and value models...',
      '{itemName}. Art valuations are complex — let me get you multiple perspectives.',
    ],
    analysis_complete_clean: [
      'Interesting — {voteCount} models agree at ${consensusValue}. That\'s unusual consensus for art.',
      'Models aligned on {itemName}. Good comparable sales data.',
      'Solid consensus on this piece. The market data is clear.',
    ],
    analysis_complete_interesting: [
      'Art is inherently subjective. {highProvider} at ${highValue} vs {lowProvider} at ${lowValue} — both could be right.',
      'The models disagree, which is actually common with art. Provenance and attribution matter enormously.',
      '{outlierProvider} sees something at ${outlierValue} that others don\'t. Worth investigating.',
    ],
  },

  general: {
    item_identified: [
      'Got it — {itemName}. Running the full analysis now...',
      '{itemName}. Let me check what the market says...',
      'Analyzing {itemName} across all our data sources...',
    ],
    analysis_complete_clean: [
      'Solid find. {voteCount} models agree on this one. Consensus looks clean.',
      'Pretty clear picture — ${consensusValue}, and the models are aligned.',
      'Good consensus across the board. The data looks solid.',
    ],
    analysis_complete_interesting: [
      'Hmm, interesting — {outlierProvider} came in at ${outlierValue} while everyone else says ${consensusValue}. Let me look at why.',
      'The models disagree on this one. {highProvider} sees ${highValue} but {lowProvider} says ${lowValue}. Worth looking at the details.',
      'Split opinion here. Tap the individual provider reports to see their reasoning.',
    ],
  },
};

// =============================================================================
// ESTATE PERSONA OVERRIDES (softer, more educational tone)
// =============================================================================

const ESTATE_OVERRIDES: Partial<Record<NarratorEventType, string[]>> = {
  item_identified: [
    'Let me take a look at {itemName} for you...',
    '{itemName} — I\'ll check what this is worth. Give me just a moment.',
    'Analyzing {itemName}. I\'ll walk you through what I find.',
  ],
  analysis_complete_clean: [
    'Good news — the AI models agree on {itemName}. ${consensusValue} looks like a fair estimate.',
    'The analysis is consistent: ${consensusValue}. Here\'s what that means for you.',
    '{voteCount} models came to the same conclusion. You can feel confident in this estimate.',
  ],
  analysis_complete_interesting: [
    'The models have some different opinions on this one. {highProvider} thinks ${highValue} but {lowProvider} says ${lowValue}. I\'d be happy to explain why.',
    'There\'s a range of estimates here — that\'s normal, especially for unique items. Let me help you understand the spread.',
    'Interesting — not all the AI models agree. This usually means condition or authenticity matters more than usual. Want me to break it down?',
  ],
};

// =============================================================================
// TEMPLATE SELECTION (seeded random for session consistency)
// =============================================================================

/**
 * Simple hash for seeded random. Same item → same template in session.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Select a template for the given context.
 * Uses seeded random selection based on itemName for session consistency.
 */
export function selectTemplate(context: NarratorContext): string {
  const { eventType, category, itemName, persona } = context;

  // Use estate overrides if applicable
  if (persona === 'estate') {
    const overrides = ESTATE_OVERRIDES[eventType];
    if (overrides && overrides.length > 0) {
      const idx = simpleHash(itemName + eventType) % overrides.length;
      return overrides[idx];
    }
  }

  // Find category-specific templates, fallback to general
  const normalizedCategory = (category || 'general').toLowerCase().replace(/\s+/g, '_');
  const categoryTemplates = TEMPLATES[normalizedCategory] || TEMPLATES.general;
  const templates = categoryTemplates[eventType] || TEMPLATES.general[eventType];

  if (!templates || templates.length === 0) {
    return 'Processing...';
  }

  // Seeded selection — same item + eventType = same template in session
  const idx = simpleHash(itemName + eventType) % templates.length;
  return templates[idx];
}

/**
 * Render a template with context values interpolated.
 * Handles missing values gracefully.
 */
export function renderTemplate(context: NarratorContext): string {
  let text = selectTemplate(context);

  // Interpolate all context values
  const replacements: Record<string, string> = {
    '{itemName}': context.itemName || 'this item',
    '{voteCount}': String(context.voteCount || '?'),
    '${consensusValue}': context.consensusValue != null ? `$${context.consensusValue.toFixed(2)}` : '$?',
    '{outlierProvider}': context.outlierProvider || 'One model',
    '${outlierValue}': context.outlierValue != null ? `$${context.outlierValue.toFixed(2)}` : '$?',
    '{highProvider}': context.highProvider || 'One model',
    '${highValue}': context.highValue != null ? `$${context.highValue.toFixed(2)}` : '$?',
    '{lowProvider}': context.lowProvider || 'Another model',
    '${lowValue}': context.lowValue != null ? `$${context.lowValue.toFixed(2)}` : '$?',
  };

  for (const [key, value] of Object.entries(replacements)) {
    text = text.replaceAll(key, value);
  }

  return text;
}
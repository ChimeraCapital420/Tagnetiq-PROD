// FILE: src/lib/oracle/chips/quick-chips.ts
// Dynamic Quick Chips — contextual conversation starters
//
// Chips change based on:
// - New user vs returning user
// - Last scan item
// - Vault size
// - Favorite categories (from Oracle identity)
// - Whether the Oracle has a name yet
// - Sprint N: Learning, introductions, content creation, seasonal

import type { OracleIdentity, QuickChip } from '../types.js';

// =============================================================================
// NEW USER CHIPS
// =============================================================================

function getNewUserChips(): QuickChip[] {
  return [
    { label: '👋 What can you do?', message: 'What can you help me with?' },
    { label: '🎯 How to start', message: 'How do I get started with TagnetIQ?' },
    { label: '💰 Best items to flip', message: 'What are the best items to flip for profit right now?' },
    { label: '🏪 Sourcing tips', message: 'Where should I source items to resell?' },
  ];
}

// =============================================================================
// CATEGORY CHIP
// =============================================================================

function getCategoryChip(identity: OracleIdentity): QuickChip {
  const favCats = identity.favorite_categories || [];

  if (favCats.includes('coins')) {
    return { label: '🪙 Coin trends', message: 'What coins are worth looking for right now?' };
  }
  if (favCats.includes('comics')) {
    return { label: '📚 Comic trends', message: 'Which comics are heating up in value?' };
  }
  if (favCats.includes('vehicles') || favCats.includes('vehicles-value')) {
    return { label: '🚗 Vehicle market', message: 'What\'s happening in the used vehicle market right now?' };
  }
  if (favCats.includes('luxury-goods') || favCats.includes('luxury-watches')) {
    return { label: '⌚ Luxury trends', message: 'What luxury items are appreciating in value right now?' };
  }
  if (favCats.includes('real-estate')) {
    return { label: '🏠 Flip analysis', message: 'Give me tips on spotting profitable real estate flips' };
  }
  if (favCats.includes('pokemon_cards') || favCats.includes('trading_cards')) {
    return { label: '🃏 Card market', message: 'What trading cards are worth chasing right now?' };
  }
  if (favCats.includes('sneakers')) {
    return { label: '👟 Sneaker drops', message: 'What sneaker releases are coming up that I should watch?' };
  }
  if (favCats.includes('lego')) {
    return { label: '🧱 LEGO investing', message: 'Which LEGO sets are good investments right now?' };
  }

  return { label: '🔥 What\'s hot', message: 'What resale categories are hot right now?' };
}

// =============================================================================
// RELATIONSHIP CHIP
// =============================================================================

function getRelationshipChip(
  identity: OracleIdentity,
  scanCount: number
): QuickChip | null {
  // Nudge name ceremony if Oracle is ready
  if (!identity.oracle_name && identity.conversation_count >= 5) {
    return { label: '🤝 What\'s your name?', message: 'Hey, what\'s your name anyway?' };
  }

  // Strategy chip for experienced users
  if (scanCount >= 5) {
    return { label: '🎯 Hunt strategy', message: 'Based on my history, what should I hunt for next?' };
  }

  return null;
}

// =============================================================================
// SPRINT N: CONTEXTUAL CHIPS
// =============================================================================

/** Learning chip — shown after 3+ conversations */
function getLearningChip(identity: OracleIdentity): QuickChip | null {
  if ((identity.conversation_count || 0) < 3) return null;

  const favCats = identity.favorite_categories || [];

  if (favCats.includes('coins') || favCats.includes('trading_cards') || favCats.includes('pokemon_cards')) {
    return { label: '🎓 Teach me grading', message: 'Teach me how grading works and why it matters for value' };
  }
  if (favCats.includes('sneakers') || favCats.includes('luxury-goods')) {
    return { label: '🔍 Authentication 101', message: 'Teach me how to spot fakes and authenticate items' };
  }
  if (favCats.length > 0) {
    return { label: '📖 Teach me', message: `Teach me about the ${favCats[0].replace(/[-_]/g, ' ')} market` };
  }

  return { label: '📖 Teach me', message: 'Teach me about negotiation strategies for resale' };
}

/** Introduction chip — shown after 8+ conversations */
function getIntroductionChip(identity: OracleIdentity): QuickChip | null {
  if ((identity.conversation_count || 0) < 8) return null;

  return { label: '🤝 Find collectors', message: 'Are there other collectors with similar interests I could connect with?' };
}

/** Content creation chip — shown when user has vault items */
function getContentChip(vaultItems: any[]): QuickChip | null {
  if (vaultItems.length === 0) return null;

  const topItem = vaultItems[0];
  const itemName = topItem?.item_name;

  if (itemName) {
    return { label: '📝 List it', message: `Write me an eBay listing for my ${itemName}` };
  }

  return { label: '📝 Create listing', message: 'Help me write a listing for something I want to sell' };
}

/** Seasonal chip — time-aware market nudges */
function getSeasonalChip(): QuickChip | null {
  const month = new Date().getMonth();

  switch (month) {
    case 0: // January
      return { label: '💸 Tax season flips', message: 'What should I be sourcing now for tax refund season buyers?' };
    case 1: // February
      return { label: '💝 V-Day resale', message: 'Any Valentine\'s Day resale opportunities?' };
    case 2: case 3: // Mar-Apr
      return { label: '🏷️ Garage sale season', message: 'Garage sale season is starting — what should I look for?' };
    case 4: case 5: // May-Jun
      return { label: '🎓 Grad gifts', message: 'What graduation gift items have good resale value?' };
    case 6: // July
      return { label: '📦 Source for Q4', message: 'What should I be sourcing NOW to sell during the holidays?' };
    case 7: // August
      return { label: '🎒 Back to school', message: 'What back-to-school items are worth flipping?' };
    case 8: case 9: // Sep-Oct
      return { label: '🎃 Halloween prep', message: 'What seasonal items should I be listing right now?' };
    case 10: // November
      return { label: '🛒 Black Friday', message: 'What Black Friday deals should I jump on for resale?' };
    case 11: // December
      return { label: '🎁 Holiday rush', message: 'What\'s selling fastest right now during the holiday rush?' };
    default:
      return null;
  }
}

// =============================================================================
// BUILD QUICK CHIPS
// =============================================================================

/**
 * Generate 4 contextual quick chips based on user state.
 * Sprint N: Adds learning, introductions, content, seasonal chips to the rotation.
 */
export function getQuickChips(
  scanHistory: any[],
  vaultItems: any[],
  identity: OracleIdentity
): QuickChip[] {
  // New user → welcome chips
  if (scanHistory.length === 0) {
    return getNewUserChips();
  }

  const chips: QuickChip[] = [];

  // ── Slot 1: Last scan (always most relevant) ──────────
  const lastScan = scanHistory[0];
  const lastItemName = lastScan?.item_name || lastScan?.analysis_result?.itemName;
  if (lastItemName) {
    const truncated = lastItemName.length > 18 ? lastItemName.substring(0, 18) + '...' : lastItemName;
    chips.push({
      label: `📊 ${truncated}`,
      message: `Tell me more about the ${lastItemName} I scanned — where should I sell it and for how much?`,
    });
  }

  // ── Slot 2: Vault or best finds ───────────────────────
  if (vaultItems.length > 0) {
    chips.push({ label: '💎 Vault value', message: 'What\'s my collection worth right now?' });
  } else {
    chips.push({ label: '📈 My best finds', message: 'What are my most valuable scans so far?' });
  }

  // ── Slot 3: Rotating contextual chip ──────────────────
  // Priority: content creation > learning > category > seasonal
  const contentChip = getContentChip(vaultItems);
  const learningChip = getLearningChip(identity);
  const categoryChip = getCategoryChip(identity);
  const seasonalChip = getSeasonalChip();

  // Use conversation count to rotate which contextual chip shows
  const convoCount = identity.conversation_count || 0;
  const rotation = convoCount % 4;

  if (rotation === 0 && contentChip) {
    chips.push(contentChip);
  } else if (rotation === 1 && learningChip) {
    chips.push(learningChip);
  } else if (rotation === 2 && seasonalChip) {
    chips.push(seasonalChip);
  } else {
    chips.push(categoryChip);
  }

  // ── Slot 4: Relationship / introductions ──────────────
  const introChip = getIntroductionChip(identity);
  const relationshipChip = getRelationshipChip(identity, scanHistory.length);

  if (introChip && convoCount % 3 === 0) {
    chips.push(introChip);
  } else if (relationshipChip) {
    chips.push(relationshipChip);
  } else {
    // Fallback: deep topic chip for engaged users
    if (convoCount >= 10) {
      chips.push({ label: '💭 Go deep', message: 'Let\'s talk about something interesting — surprise me with a topic' });
    } else {
      chips.push(categoryChip);
    }
  }

  // Deduplicate and limit to 4
  const seen = new Set<string>();
  return chips.filter(chip => {
    if (seen.has(chip.label)) return false;
    seen.add(chip.label);
    return true;
  }).slice(0, 4);
}

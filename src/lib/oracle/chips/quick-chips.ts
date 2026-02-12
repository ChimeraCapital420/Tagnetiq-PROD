// FILE: src/lib/oracle/chips/quick-chips.ts
// Dynamic Quick Chips — contextual conversation starters
//
// Chips change based on:
// - New user vs returning user
// - Last scan item
// - Vault size
// - Favorite categories (from Oracle identity)
// - Whether the Oracle has a name yet

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
// BUILD QUICK CHIPS
// =============================================================================

/**
 * Generate 4 contextual quick chips based on user state.
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

  // 1. Last scan item
  const lastScan = scanHistory[0];
  const lastItemName = lastScan?.item_name || lastScan?.analysis_result?.itemName;
  if (lastItemName) {
    chips.push({
      label: `📊 ${lastItemName.substring(0, 18)}...`,
      message: `Tell me more about the ${lastItemName} I scanned — where should I sell it and for how much?`,
    });
  }

  // 2. Vault value or best finds
  if (vaultItems.length > 0) {
    chips.push({ label: '💎 Vault value', message: 'What\'s my collection worth right now?' });
  } else {
    chips.push({ label: '📈 My best finds', message: 'What are my most valuable scans so far?' });
  }

  // 3. Category-specific
  chips.push(getCategoryChip(identity));

  // 4. Relationship-depth or strategy
  const relationshipChip = getRelationshipChip(identity, scanHistory.length);
  if (relationshipChip) {
    chips.push(relationshipChip);
  }

  return chips.slice(0, 4);
}
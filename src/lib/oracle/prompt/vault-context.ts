// FILE: src/lib/oracle/prompt/vault-context.ts
// Builds the vault items + user profile sections of the system prompt.

// =============================================================================
// VAULT
// =============================================================================

export function buildVaultContext(vaultItems: any[]): string {
  let context = '\n\n## USER VAULT (their saved collection)\n';

  if (vaultItems.length === 0) {
    context += 'Vault is empty. If they ask about their collection, let them know they can save scanned items to their vault to track value over time.\n';
    return context;
  }

  let vaultTotal = 0;
  context += `${vaultItems.length} items in vault:\n\n`;

  for (const item of vaultItems.slice(0, 20)) {
    const value = parseFloat(
      String(item.estimated_value || '0').replace(/[^0-9.]/g, '')
    );
    if (!isNaN(value)) vaultTotal += value;

    context += `- ${item.item_name || 'Unnamed item'}`;
    if (item.estimated_value) context += ` | Value: $${item.estimated_value}`;
    if (item.category) context += ` | Category: ${item.category}`;
    if (item.condition) context += ` | Condition: ${item.condition}`;
    context += '\n';
  }

  if (vaultItems.length > 20) {
    context += `... and ${vaultItems.length - 20} more items.\n`;
  }

  context += `\nTotal vault value: ~$${vaultTotal.toLocaleString()}\n`;
  context += `When asked "what's my collection worth?" — use this number and break it down by category if possible.\n`;

  return context;
}

// =============================================================================
// USER PROFILE
// =============================================================================

export function buildProfileContext(userProfile: any): string {
  if (!userProfile) return '';

  let context = '\n\n## USER PROFILE\n';

  if (userProfile.display_name) {
    context += `Name: ${userProfile.display_name}\n`;
  }

  if (userProfile.settings?.interests) {
    context += `Interests: ${JSON.stringify(userProfile.settings.interests)}\n`;
  }

  if (userProfile.settings?.language) {
    context += `Preferred language: ${userProfile.settings.language}\n`;
  }

  return context;
}
// FILE: src/lib/boardroom/evolution/trust.ts
// ═══════════════════════════════════════════════════════════════════════
// TRUST LEVEL HELPERS & DNA FLAVOR TEXT
// ═══════════════════════════════════════════════════════════════════════
//
// Trust tiers determine what a board member can do autonomously.
// DNA traits describe provider personality for UI display.
//
// ═══════════════════════════════════════════════════════════════════════

// ============================================================================
// TRUST TIERS
// ============================================================================

export function getTrustTier(trustLevel: number): 'observer' | 'advisor' | 'trusted' | 'autonomous' {
  if (trustLevel < 40) return 'observer';
  if (trustLevel < 60) return 'advisor';
  if (trustLevel < 80) return 'trusted';
  return 'autonomous';
}

export function getTrustDescription(trustLevel: number): string {
  const tier = getTrustTier(trustLevel);
  switch (tier) {
    case 'observer':
      return 'Observer. You provide analysis and recommendations. All actions require human approval.';
    case 'advisor':
      return 'Advisor. You can make minor decisions within your domain. Major actions need approval.';
    case 'trusted':
      return 'Trusted. You can act within your domain with post-hoc review. You\'ve earned this.';
    case 'autonomous':
      return 'Autonomous. Full authority in your domain. You\'ve proven yourself through consistent excellence.';
  }
}

// ============================================================================
// DNA FLAVOR TEXT — Provider personality descriptions for UI
// ============================================================================

export const DNA_TRAITS: Record<string, string> = {
  openai: 'versatile and clear-headed, strong at structured reasoning',
  anthropic: 'deeply analytical with nuanced ethical awareness',
  google: 'fast pattern recognition with broad knowledge synthesis',
  deepseek: 'rigorous reasoning with deep analytical precision',
  groq: 'lightning-fast with crisp decisive energy',
  xai: 'creative and contrarian with real-time awareness',
  perplexity: 'research-obsessed with always-current information',
  mistral: 'precise and efficient with European engineering discipline',
};
// FILE: src/lib/oracle/prompt/creator-context.ts
// Builds prompt blocks for content creation (listings, videos, images)
// Injects user voice profile + platform rules + item data
// The secret sauce: listings that sound like the USER wrote them, not AI

import type { VoiceProfile } from '../voice-profile/index.js';

// =============================================================================
// LISTING GENERATION PROMPT
// =============================================================================

export function buildListingPrompt(params: {
  voiceProfile: VoiceProfile | null;
  platform: string;
  itemName: string;
  itemCategory?: string;
  condition?: string;
  estimatedValue?: { low: number; high: number };
  userInstructions?: string;
  images?: number;
}): string {
  const { voiceProfile, platform, itemName, itemCategory, condition, estimatedValue, userInstructions, images } = params;

  const sections: string[] = [];

  sections.push(`Generate a marketplace listing for: ${itemName}`);
  sections.push(`Platform: ${platform.toUpperCase()}`);

  if (itemCategory) sections.push(`Category: ${itemCategory}`);
  if (condition) sections.push(`Condition: ${condition}`);
  if (estimatedValue) {
    sections.push(`Estimated value range: $${estimatedValue.low} - $${estimatedValue.high}`);
  }
  if (images) sections.push(`Number of photos: ${images}`);
  if (userInstructions) sections.push(`User instructions: ${userInstructions}`);

  // Platform-specific optimization rules
  sections.push(`\n${getPlatformRules(platform)}`);

  // Voice profile injection
  if (voiceProfile && voiceProfile.messageCount >= 10) {
    sections.push('\n## WRITE IN THE USER\'S VOICE');
    sections.push(`This user writes ${voiceProfile.vocabularyLevel}ly with ${voiceProfile.avgSentenceLength}-word sentences on average.`);

    if (voiceProfile.toneMarkers.length > 0) {
      sections.push(`Their tone is: ${voiceProfile.toneMarkers.join(', ')}`);
    }
    if (voiceProfile.emojiStyle !== 'none') {
      sections.push(`They use emojis ${voiceProfile.emojiStyle === 'heavy' ? 'frequently' : 'occasionally'} — mirror this.`);
    }
    if (voiceProfile.humorStyle !== 'none') {
      sections.push(`Humor style: ${voiceProfile.humorStyle} — incorporate naturally.`);
    }
    if (voiceProfile.commonPhrases.length > 0) {
      sections.push(`Phrases they use: "${voiceProfile.commonPhrases.slice(0, 5).join('", "')}"`);
    }
    if (voiceProfile.sampleMessages.length > 0) {
      sections.push('\nHere are examples of how they write:');
      for (const sample of voiceProfile.sampleMessages.slice(0, 3)) {
        sections.push(`> "${sample.substring(0, 150)}"`);
      }
    }

    sections.push('\nMatch this style. The listing should sound like THEY wrote it, not an AI. Don\'t overcorrect — natural is better than forced mimicry.');
  } else {
    sections.push('\nNo voice profile available yet. Write a clean, professional listing with personality.');
  }

  // Output format
  sections.push(`
## OUTPUT FORMAT (respond ONLY with this JSON):
{
  "title": "Optimized listing title for ${platform} (max ${platform === 'ebay' ? '80' : '140'} chars)",
  "description": "Full listing description in user's voice",
  "suggestedPrice": 0.00,
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "condition": "condition label for platform",
  "shippingNotes": "shipping recommendation"
}`);

  return sections.join('\n');
}

// =============================================================================
// VIDEO SCRIPT PROMPT
// =============================================================================

export function buildVideoScriptPrompt(params: {
  itemName: string;
  itemCategory?: string;
  estimatedValue?: { low: number; high: number };
  style: 'showcase' | 'unboxing' | 'flip_story' | 'market_update';
  platform: 'tiktok' | 'instagram' | 'youtube';
  voiceProfile: VoiceProfile | null;
}): string {
  const { itemName, itemCategory, estimatedValue, style, platform, voiceProfile } = params;

  const durationGuide = platform === 'tiktok' ? '15-30 seconds' :
                         platform === 'instagram' ? '30-60 seconds' : '2-3 minutes';

  const sections = [
    `Write a ${style} video script for: ${itemName}`,
    `Platform: ${platform} (${durationGuide})`,
  ];

  if (itemCategory) sections.push(`Category: ${itemCategory}`);
  if (estimatedValue) sections.push(`Value: $${estimatedValue.low}-$${estimatedValue.high}`);

  const styleGuides: Record<string, string> = {
    showcase: 'Clean product showcase — highlight features, condition, special details. Professional but approachable.',
    unboxing: 'Authentic unboxing energy — genuine reactions, discoveries, first impressions. Build anticipation.',
    flip_story: 'Tell the flip story — what you paid, what it\'s worth, the find story. Engaging narrative.',
    market_update: 'Market intelligence — trending prices, what\'s hot, buying opportunities. Authority voice.',
  };

  sections.push(`\nStyle: ${styleGuides[style] || styleGuides.showcase}`);

  if (voiceProfile && voiceProfile.messageCount >= 10) {
    sections.push(`\nMatch the user's voice: ${voiceProfile.toneMarkers.join(', ')} | ${voiceProfile.vocabularyLevel} vocabulary`);
  }

  sections.push(`
## OUTPUT FORMAT (respond ONLY with this JSON):
{
  "script": "Full script with scene directions in [brackets]",
  "scenes": [
    { "description": "Scene description", "duration_seconds": 5, "text_overlay": "optional text" }
  ],
  "music_vibe": "suggested music mood",
  "hashtags": ["tag1", "tag2"]
}`);

  return sections.join('\n');
}

// =============================================================================
// BRAG CARD PROMPT
// =============================================================================

export function buildBragCardPrompt(params: {
  itemName: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  roi: number;
  sourceStory?: string;
}): string {
  return `Create a social media brag card for this flip:

Item: ${params.itemName}
Paid: $${params.buyPrice}
Sold: $${params.sellPrice}
Profit: $${params.profit} (${params.roi}% ROI)
${params.sourceStory ? `Story: ${params.sourceStory}` : ''}

Generate:
{
  "headline": "Punchy headline (5-8 words)",
  "subtext": "One-liner about the find/flip",
  "stats": { "paid": "${params.buyPrice}", "sold": "${params.sellPrice}", "profit": "${params.profit}", "roi": "${params.roi}%" },
  "emoji": "single emoji that captures the vibe",
  "hashtags": ["3-5 relevant hashtags"]
}`;
}

// =============================================================================
// PLATFORM RULES
// =============================================================================

function getPlatformRules(platform: string): string {
  const rules: Record<string, string> = {
    ebay: `## eBay Listing Rules:
- Title: Max 80 characters. Front-load with brand, model, key features. No spam keywords.
- Description: Start with key details (brand, model, size, condition). Include measurements if applicable.
- Item specifics are critical for search visibility — suggest relevant ones.
- Mention shipping (calculated vs flat rate) and return policy.
- For used items: honest condition notes build trust and reduce returns.`,

    mercari: `## Mercari Listing Rules:
- Title: Max 140 characters. Clear and specific.
- Description: Friendly, conversational. Mention flaws honestly.
- Price: Include room for offers (Mercari buyers negotiate).
- Photos are king — suggest angles and details to photograph.
- Hashtags in description help search visibility.`,

    poshmark: `## Poshmark Listing Rules:
- Title: Brand first, then item type, then details.
- Description: Size, measurements, condition, styling tips.
- Community-focused — friendly, personal tone works best.
- Cover photo should be flat-lay or on-body/display.
- Price should account for Poshmark's 20% fee.`,

    facebook: `## Facebook Marketplace Rules:
- Title: Clear, no ALL CAPS. Include location keywords.
- Description: Brief but complete. Answer common questions upfront.
- Local pickup focus — mention neighborhood/area.
- Price: Competitive. FB buyers are price-sensitive.
- Respond to messages quickly — algorithm rewards responsiveness.`,

    amazon: `## Amazon FBA Listing Rules:
- Match to existing ASIN when possible.
- Condition notes must be precise (Amazon's condition guidelines).
- Competitive pricing — check keepa/camelcamelcamel data.
- Include dimensions/weight for FBA fee estimation.
- Keywords in bullet points, not keyword stuffing.`,

    whatnot: `## Whatnot Listing Rules:
- Title: Catchy, collectors-focused. Include key identifiers.
- Starting price should be LOW (auction format drives engagement).
- Description: Authentication details, grading info, provenance.
- Category-specific details (set, year, variant, chase, etc).
- Hype words that are genuine work well (rare, hard-to-find, grail).`,
  };

  return rules[platform.toLowerCase()] || rules.ebay;
}

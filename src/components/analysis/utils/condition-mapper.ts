// FILE: src/components/analysis/utils/condition-mapper.ts
// Maps free-text condition strings to the enum values expected by arena_listings.

const VALID_CONDITIONS = ['mint', 'near_mint', 'excellent', 'good', 'fair', 'poor'] as const;

const ALIASES: Record<string, string> = {
  'new': 'mint',
  'brand_new': 'mint',
  'like_new': 'near_mint',
  'very_good': 'good',
  'acceptable': 'fair',
  'damaged': 'poor',
  'used': 'good',
};

export function mapConditionToEnum(condition: string): string {
  const normalized = condition.toLowerCase().trim().replace(/[\s-]+/g, '_');

  if ((VALID_CONDITIONS as readonly string[]).includes(normalized)) return normalized;

  return ALIASES[normalized] || 'good';
}
// FILE: src/components/marketplace/platforms/conditionMaps.ts
// Platform-specific condition terminology mappings

export const CONDITION_MAP: Record<string, Record<string, string>> = {
  ebay: {
    'mint': 'New',
    'near_mint': 'New',
    'near-mint': 'New',
    'excellent': 'Like New',
    'good': 'Very Good',
    'fair': 'Good',
    'poor': 'Acceptable',
  },
  facebook: {
    'mint': 'New',
    'near_mint': 'Like new',
    'near-mint': 'Like new',
    'excellent': 'Good',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Fair',
  },
  mercari: {
    'mint': 'Brand New',
    'near_mint': 'Like New',
    'near-mint': 'Like New',
    'excellent': 'Good',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor',
  },
  tcgplayer: {
    'mint': 'Near Mint',
    'near_mint': 'Near Mint',
    'near-mint': 'Near Mint',
    'excellent': 'Lightly Played',
    'good': 'Moderately Played',
    'fair': 'Heavily Played',
    'poor': 'Damaged',
  },
  discogs: {
    'mint': 'Mint (M)',
    'near_mint': 'Near Mint (NM)',
    'near-mint': 'Near Mint (NM)',
    'excellent': 'Very Good Plus (VG+)',
    'good': 'Very Good (VG)',
    'fair': 'Good (G)',
    'poor': 'Fair (F)',
  },
  default: {
    'mint': 'Mint',
    'near_mint': 'Near Mint',
    'near-mint': 'Near Mint',
    'excellent': 'Excellent',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor',
  },
};

export const getCondition = (platform: string, condition?: string): string => {
  const normalized = (condition || 'good').toLowerCase().trim().replace(' ', '_');
  const platformMap = CONDITION_MAP[platform] || CONDITION_MAP.default;
  return platformMap[normalized] || platformMap['good'] || 'Good';
};
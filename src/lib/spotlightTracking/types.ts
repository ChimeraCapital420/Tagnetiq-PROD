// FILE: src/lib/spotlightTracking/types.ts
// ═══════════════════════════════════════════════════════════════════════
// SPOTLIGHT TRACKING TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export interface TimestampedAction {
  value: string;
  timestamp: string;
  count?: number;
}

export interface CategoryScore {
  category: string;
  score: number;
  sources: string[]; // What contributed to this score
}

export interface SpotlightPrefs {
  // Timestamped behavioral data (for decay calculation)
  category_interactions: TimestampedAction[];
  item_clicks: TimestampedAction[];
  item_views: TimestampedAction[];
  searches: TimestampedAction[];
  purchases: TimestampedAction[];

  // User-controlled (no decay)
  hidden_item_ids: string[];
  hidden_categories: string[];
  favorite_categories: string[];
  active_filter?: string;

  // Onboarding seeds (low constant weight)
  onboarding_interests: string[];

  // Location
  location?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  };

  // Price learning
  price_history: { price: number; timestamp: string }[];

  // Sync
  last_updated: string;
  last_synced?: string;
  needs_sync: boolean;

  // Analytics
  total_interactions: number;
  first_interaction?: string;
}

export interface WatchlistItem {
  id: string;
  keywords: string[];
  created_at: string;
}

export interface PersonalizationStatus {
  level: string;
  icon: string;
  label: string;
  description: string;
  dataPoints: number;
  confidence: number; // 0-100
}
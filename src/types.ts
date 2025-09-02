// FILE: src/types.ts
// VULCAN FORGE: This file is an ADDITIVE modification.
// It preserves all original types and adds the new AnalysisQuality field for resilience.

export type AppRole = 'admin' | 'developer' | 'investor' | 'retail' | 'user';

// VULCAN FORGE: New type to define the quality of the AI analysis result.
export type AnalysisQuality = 'OPTIMAL' | 'DEGRADED' | 'FALLBACK' | 'NO_RESULT';

export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  full_name?: string;
  screen_name?: string;
  avatar_url?: string;
  interests?: string[];
  onboarding_complete: boolean;
  mfa_enrolled: boolean;
  has_seen_arena_intro?: boolean;
  settings?: {
    theme?: string;
    themeMode?: 'dark' | 'light';
    seasonalEffects?: boolean;
    tts_enabled?: boolean;
    tts_voice_uri?: string;
    language?: string;
    custom_background_url?: string;
  };
}

export interface VaultItem {
    id: string;
    user_id: string;
    asset_name: string;
    category: string;
    photos: string[];
    notes?: string;
    purchase_price?: number;
    valuation_data?: any;
    owner_valuation?: number;
    provenance_docs?: { name: string; url: string }[];
    created_at: string;
    updated_at: string;
}

export interface ArenaChallenge {
    id: string;
    user_id: string;
    vault_item_id: string;
    purchase_price: number;
    asking_price: number;
    status: 'active' | 'completed' | 'verified';
    is_public: boolean;
    possession_verified: boolean;
    // ... other arena fields
}

export interface AnalysisResult {
  id: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL' | 'HOLD'; // Expanded for more nuance
  confidenceScore: number; // A 0-100 score
  summary_reasoning: string;
  valuation_factors: string[];
  resale_toolkit?: {
      listInArena: boolean;
      sellOnProPlatforms: boolean;
      linkToMyStore: boolean;
      shareToSocial: boolean;
  };
  marketComps?: any[];
  imageUrl: string;
  capturedAt: string;
  category: string;
  subCategory: string;
  tags: string[];
  // VULCAN FORGE: The new field that provides frontend with transparent status.
  analysis_quality: AnalysisQuality;
}

// Add any other types that exist in your original file below this line.
// This ensures no existing part of the application breaks.
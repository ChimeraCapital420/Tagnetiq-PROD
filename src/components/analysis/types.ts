// FILE: src/components/analysis/types.ts
// All types for the Analysis Result component tree.
// Extracted from AnalysisResult.tsx monolith.

import type { GhostData } from '@/hooks/useGhostMode';
import type { MarketplaceItem } from '@/components/marketplace/platforms/types';

// =============================================================================
// NEXUS DECISION TREE TYPES
// =============================================================================

export interface NexusAction {
  id: string;
  label: string;
  type: 'list' | 'vault' | 'watch' | 'dismiss' | 'ghost_list' | 'scan_more';
  vaultCategory?: string;
  primary: boolean;
  icon?: string;
}

export interface NexusData {
  nudge: string;
  message: string;
  marketDemand: string;
  confidence: number;
  actions: NexusAction[];
  listingDraft?: {
    suggestedPrice?: number;
    priceRange?: { low?: number; high?: number };
    suggestions?: string[];
    description?: string;
  };
  followUp?: string;
}

// =============================================================================
// ANALYSIS RESULT (mirrors what the API returns)
// =============================================================================

export interface AnalysisResultData {
  id?: string;
  itemName?: string;
  estimatedValue?: number | string;
  confidenceScore?: number;
  confidence?: number;
  summary_reasoning?: string;
  valuation_factors?: string[];
  imageUrl?: string;
  imageUrls?: string[];
  category?: string;
  condition?: string;
  tags?: string[];
  brand?: string;
  model?: string;
  year?: string;
  hydraConsensus?: any;
  authorityData?: any;
  ghostData?: GhostData | null;
  nexus?: NexusData | null;
  [key: string]: any; // Allow extra fields from API
}

// =============================================================================
// EXTRACTED / NORMALIZED ANALYSIS DATA
// =============================================================================

export interface NormalizedAnalysis {
  id: string;
  itemName: string;
  estimatedValue: number;
  confidenceScore: number;
  confidenceNormalized: number;
  summaryReasoning: string;
  valuationFactors: string[];
  allImageUrls: string[];
  category: string;
  condition: string;
  hydraConsensus: any | null;
  authorityData: any | null;
  ghostData: GhostData | null;
  nexusData: NexusData | null;
  confidenceColor: string;
  marketplaceItem: MarketplaceItem;
}

// =============================================================================
// HISTORY CONTEXT
// =============================================================================

export interface HistoryContext {
  isViewingHistory: boolean;
  historyItem: any | null;
}

// =============================================================================
// CALLBACK TYPES
// =============================================================================

export interface AnalysisCallbacks {
  onClear: () => void;
  onDeleteFromHistory: () => void;
  onRefine: () => void;
  onNexusList: () => void;
  onNexusVault: () => void;
  onNexusWatch: () => void;
  onNexusDismiss: () => void;
  onNexusScanMore: () => void;
  onListOnTagnetiq: (
    item: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData
  ) => Promise<void>;
}
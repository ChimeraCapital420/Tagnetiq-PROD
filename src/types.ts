// src/types.ts

/**
 * Represents a single comparable sale from the market.
 */
export interface MarketComp {
  source: string;
  itemName: string;
  price: number;
  date: string;
  url: string;
  imageUrl?: string;
}

/**
 * The structure for the "Actionable Intelligence Loop" toolkit.
 * Defines the actions a user can take after an analysis.
 */
export interface ResaleToolkit {
  listInArena: boolean;
  sellOnProPlatforms: boolean;
  linkToMyStore: boolean;
  shareToSocial: boolean;
  generatePosBarcode?: boolean; // For Retailer role
  pushToWebsite?: boolean;      // For Retailer role
  postToBusinessSocials?: boolean; // For Retailer role
}

/**
 * The primary data object returned by the Hydra Consensus Engine (v2.1).
 * This is the foundational data structure for the Nexus Command Deck.
 */
export interface AnalysisResult {
  id: string;
  capturedAt: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL' | 'HOLD';
  
  /**
   * @deprecated Replaced by summary_reasoning and valuation_factors in v2.1
   */
  reasoning?: string; 

  // New fields for v2.1
  summary_reasoning: string;
  valuation_factors: string[];

  marketComps: MarketComp[];
  resale_toolkit: ResaleToolkit;
  confidenceScore: number;
  category: string;
  subCategory: string;
  tags: string[];
  imageUrl: string;
}

/**
 * Defines the structure for a user's profile in the system.
 */
export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'individual' | 'retailer' | 'admin' | 'investor';
  // Add other profile fields as necessary
}
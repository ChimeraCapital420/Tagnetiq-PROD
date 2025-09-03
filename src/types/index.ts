// FILE: src/types/index.ts
// Complete type definitions for the Tagnetiq platform

// Re-export from existing types
export type { AppRole, AnalysisQuality, Profile, AnalysisResult } from '../types';

// Vault Types
export interface VaultItem {
  id: string;
  user_id: string;
  vault_number: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  images: string[];
  acquisition_price?: number;
  acquisition_date?: string;
  condition?: string;
  metadata?: Record<string, any>;
  is_public: boolean;
  is_listed?: boolean;
  listed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  valuations?: Valuation[];
}

export interface Valuation {
  id: string;
  vault_item_id: string;
  value: number;
  source: 'manual' | 'ai' | 'market' | 'comp';
  confidence: number;
  created_at: string;
  metadata?: {
    comparables?: any[];
    market_trends?: any;
  };
}

// Arena Types
export type ListingStatus = 'draft' | 'active' | 'sold' | 'expired' | 'cancelled';
export type ChallengeStatus = 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type ItemCondition = 'mint' | 'near-mint' | 'excellent' | 'good' | 'fair' | 'poor';
export type AlertType = 'new_message' | 'new_offer' | 'new_challenge' | 'new_listing' | 'price_change' | 'challenge_update';

export interface ArenaListing {
  id: string;
  seller_id: string;
  vault_item_id: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  condition: ItemCondition;
  images: string[];
  shipping_included: boolean;
  accepts_trades: boolean;
  status: ListingStatus;
  views: number;
  watchers: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  sold_at?: string;
  deleted_at?: string;
  metadata?: Record<string, any>;
  // Relations
  seller?: Profile;
  vault_item?: VaultItem;
}

export interface ArenaChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  wager_amount: number;
  time_limit_hours: number;
  max_participants: number;
  current_participants: number;
  rules: string[];
  status: ChallengeStatus;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at: string;
  winner_id?: string;
  metadata?: Record<string, any>;
  // Relations
  creator?: Profile;
  participants?: ChallengeParticipant[];
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
  submission_url?: string;
  submitted_at?: string;
  points_earned: number;
  status: 'active' | 'submitted' | 'winner' | 'loser' | 'withdrawn';
  won_at?: string;
  // Relations
  user?: Profile;
  challenge?: ArenaChallenge;
}

export interface ArenaConversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  listing_id?: string;
  created_at: string;
  updated_at: string;
  last_message_id?: string;
  unread_count: {
    participant1: number;
    participant2: number;
  };
  is_archived: boolean;
  // Relations
  participant1?: Profile;
  participant2?: Profile;
  listing?: ArenaListing;
  last_message?: ArenaMessage;
}

export interface ArenaMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments: string[];
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  delivered_at?: string;
  read_at?: string;
  edited_at?: string;
  deleted_at?: string;
  // Relations
  sender?: Profile;
  conversation?: ArenaConversation;
}

export interface ArenaOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  created_at: string;
  updated_at: string;
  expires_at: string;
  responded_at?: string;
  // Relations
  listing?: ArenaListing;
  buyer?: Profile;
}

export interface ArenaTransaction {
  id: string;
  listing_id?: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  final_amount: number;
  status: TransactionStatus;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: Record<string, any>;
  // Relations
  listing?: ArenaListing;
  buyer?: Profile;
  seller?: Profile;
}

export interface ArenaAlert {
  id: string;
  user_id: string;
  type: AlertType;
  title: string;
  message: string;
  related_id?: string;
  related_type?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at: string;
}

// Beta Types
export interface BetaTester {
  id: string;
  user_id: string;
  referral_code: string;
  referred_by?: string;
  activation_date?: string;
  total_feedback: number;
  missions_completed: number;
  points_earned: number;
  created_at: string;
  updated_at: string;
  // Relations
  user?: Profile;
}

export interface Mission {
  id: string;
  key: string;
  title: string;
  description: string;
  points: number;
  category: 'onboarding' | 'feature_test' | 'bug_hunt' | 'feedback';
  requirements?: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface MissionProgress {
  id: string;
  tester_id: string;
  mission_key: string;
  completed: boolean;
  completed_at?: string;
  metadata?: Record<string, any>;
}

export interface Feedback {
  id: string;
  tester_id: string;
  category: string;
  severity: string;
  message: string;
  status: 'new' | 'in_review' | 'fix_in_progress' | 'shipped';
  route: string;
  app_version: string;
  device_info?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Relations
  tester?: BetaTester;
}
// FILE: src/types/investor.ts
// These types mirror the Supabase tables for the Investor Suite.

export interface Investor {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: 'pending' | 'active' | 'archived';
  created_at: string;
}

export interface InvestorInvite {
  id: string;
  investor_id: string;
  token: string;
  expires_at: string;
  mode: 'live' | 'demo';
  created_by: string;
  revoked: boolean;
  created_at: string;
}

export interface InvestorEvent {
  id: number;
  invite_id: string;
  event_type: 'email_open' | 'link_click' | 'portal_view' | 'doc_view' | 'qr_scan';
  ip?: string;
  ua?: string;
  referrer?: string;
  properties?: Record<string, any>;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  slug: string;
  storage_path: string;
  watermark: boolean;
  created_at: string;
}

export interface DocumentView {
  id: number;
  doc_id: string;
  invite_id: string;
  duration_ms?: number;
  created_at: string;
}

export interface Referral {
  id: number;
  source_type: 'investor' | 'tester';
  source_id: string;
  new_user_id: string;
  created_at: string;
}
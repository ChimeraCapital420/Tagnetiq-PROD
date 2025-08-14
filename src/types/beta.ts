// FILE: src/types/beta.ts
// These types mirror the Supabase tables for the Beta Tester Suite.

export interface BetaInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  created_by: string;
  revoked: boolean;
  created_at: string;
}

export interface BetaTester {
  id: string;
  user_id: string;
  email: string;
  referral_code: string;
  invited_by?: string;
  created_at: string;
}

export interface BetaEvent {
  id: number;
  tester_id: string;
  event_type: 'welcome_view' | 'pdf_download' | 'mission_complete' | 'feedback_open' | 'feedback_submit' | 'referral_open';
  route?: string;
  properties?: Record<string, any>;
  created_at: string;
}

export interface Feedback {
  id: string;
  tester_id: string;
  category: 'Bug' | 'Feature' | 'UI' | 'Performance' | 'Other';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  screenshot_url?: string;
  app_version: string;
  route: string;
  device?: Record<string, any>;
  flags?: Record<string, any>;
  status: 'new' | 'in_review' | 'fix_in_progress' | 'shipped';
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  key: string;
  title: string;
  description: string;
  points: number;
}

export interface MissionProgress {
  id: number;
  tester_id: string;
  mission_key: string;
  completed: boolean;
  completed_at?: string;
}

export interface PatchNote {
  id: string;
  version: string;
  notes: string;
  created_at: string;
}
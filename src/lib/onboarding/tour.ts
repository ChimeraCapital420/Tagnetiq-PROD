// FILE: src/lib/onboarding/tour.ts
// Guided Tour Engine
//
// Sprint E: Oracle-guided walkthrough for new users.
//
// Tours are step-by-step guided experiences where the Oracle
// speaks to the user and highlights UI elements. Each step has:
//   - A voice clip (pre-recorded, not live TTS — zero latency)
//   - A target element (CSS selector to highlight)
//   - A text transcript (for accessibility + muted mode)
//   - A next condition (auto-advance, user click, or timeout)
//
// Tour types:
//   first_visit      — New user: welcome → scan → vault → marketplace → voice setup
//   control_panel    — Settings: privacy, autonomy, Oracle prefs, notifications
//   vault_intro      — First time opening vault
//   marketplace_intro — First time in marketplace
//   oracle_deep      — Oracle features: history, sharing, personality
//   scanner_pro      — Advanced: ghost mode, batch scanning, camera settings
//
// PHILOSOPHY:
//   - Tours are conversational, not instructional
//   - Oracle speaks AS the guide — it's not a tooltip, it's a friend showing you around
//   - "Don't show again" is always available and respected
//   - Tours can be re-accessed from settings

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface TourStep {
  id: string;
  title: string;
  transcript: string;           // What Oracle says (text version)
  voiceClipUrl?: string;        // Pre-recorded audio URL
  targetSelector?: string;      // CSS selector to highlight
  targetPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  advanceOn: 'click' | 'next_button' | 'auto' | 'scan_complete' | 'action';
  autoAdvanceMs?: number;       // If advanceOn is 'auto'
  showSkip: boolean;
  illustration?: string;        // Optional image/animation URL
}

export interface TourDefinition {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  estimatedDurationSec: number;
  canDismiss: boolean;
}

// =============================================================================
// TOUR DEFINITIONS
// =============================================================================

export const TOURS: Record<string, TourDefinition> = {

  // ── FIRST VISIT ─────────────────────────────────────────
  first_visit: {
    id: 'first_visit',
    name: 'Welcome to TagnetIQ',
    description: 'Your Oracle shows you around',
    estimatedDurationSec: 60,
    canDismiss: true,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome',
        transcript: "Hey — welcome to TagnetIQ. I'm your Oracle, and I'm going to be your partner here. Think of me as the friend who knows what everything is worth. Let me show you around real quick.",
        targetSelector: undefined,  // Full screen overlay
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'scanner_intro',
        title: 'The Scanner',
        transcript: "This is your scanner. Point it at anything — a coin, a LEGO set, a vintage watch, a random thrift store find — and I'll tell you what it is, what it's worth, and whether you should buy it. Try it. Grab something near you.",
        targetSelector: '[data-tour="scanner-button"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'first_scan_prompt',
        title: 'Your First Scan',
        transcript: "Go ahead — scan something. Anything. I'll wait right here.",
        targetSelector: '[data-tour="camera-trigger"]',
        targetPosition: 'bottom',
        advanceOn: 'scan_complete',
        showSkip: true,
      },
      {
        id: 'scan_reaction',
        title: 'Nice Find',
        transcript: "Not bad for your first scan! I pulled data from multiple sources and cross-referenced it with real market listings. Every scan teaches me more about what you're interested in.",
        targetSelector: '[data-tour="scan-result"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'vault_intro',
        title: 'Your Vault',
        transcript: "This is your vault. Every item you save goes here — with photos, values, and history. Think of it as your personal collection database. Some people use it for reselling, some for insurance documentation, some just to keep track of what they own.",
        targetSelector: '[data-tour="vault-tab"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'oracle_chat',
        title: 'Talk to Me',
        transcript: "And this is where we talk. Ask me anything — not just about items. I can help with pricing strategy, market trends, or just have a conversation. The more we talk, the better I understand what you're looking for.",
        targetSelector: '[data-tour="oracle-tab"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'voice_setup',
        title: 'Set My Voice',
        transcript: "One more thing — you can choose how I sound. I've got several voice options. Pick the one that feels right for us. You can always change it later in settings.",
        targetSelector: '[data-tour="voice-settings"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'share_hint',
        title: 'Share Your Finds',
        transcript: "When you find something cool — and you will — you can share our conversation with friends. One tap, instant link. Some of our best users got started because a friend shared a scan that blew their mind.",
        targetSelector: '[data-tour="share-button"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'tour_complete',
        title: "You're Ready",
        transcript: "That's the basics. You've got a scanner, a vault, a marketplace, and me. Go scan something else — every item is a story waiting to be told. I'll be right here when you need me.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: false,
      },
    ],
  },

  // ── CONTROL PANEL TOUR ──────────────────────────────────
  control_panel: {
    id: 'control_panel',
    name: 'Your Control Panel',
    description: 'Customize your experience',
    estimatedDurationSec: 45,
    canDismiss: true,
    steps: [
      {
        id: 'cp_welcome',
        title: 'Your Settings',
        transcript: "This is your control panel — where you customize everything about how TagnetIQ works for you. Let me walk you through the important stuff.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_oracle_prefs',
        title: 'Oracle Preferences',
        transcript: "Here you can change my name, my voice, and how I communicate with you. Some people like me formal. Some like me casual. Your call.",
        targetSelector: '[data-tour="oracle-preferences"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_privacy',
        title: 'Privacy Controls',
        transcript: "Privacy is yours to control. Every conversation is private by default. You choose what to share, what to lock, and what to delete. I never share your data without your explicit permission.",
        targetSelector: '[data-tour="privacy-settings"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_notifications',
        title: 'Notifications',
        transcript: "I can send you a morning digest — a quick summary of what happened overnight with your vault, your watchlist, and the market. You control what I send and when.",
        targetSelector: '[data-tour="notification-settings"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_autonomy',
        title: 'AI Autonomy',
        transcript: "This is the autonomy section. If you run a business, I can help manage inventory — reordering, stock alerts, that sort of thing. But only if you turn it on and set the rules. I never act without your permission.",
        targetSelector: '[data-tour="autonomy-settings"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_vault_types',
        title: 'Vault Types',
        transcript: "You have three vault types: Personal for insurance and home inventory, Resale for items you're flipping, and Inventory for business stock management. Each one behaves differently — I only monitor market prices on Resale vaults.",
        targetSelector: '[data-tour="vault-type-settings"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'cp_done',
        title: 'All Set',
        transcript: "That's your control panel. Come back here anytime to adjust how things work. Now go scan something.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: false,
      },
    ],
  },
};

// =============================================================================
// PROGRESS TRACKING
// =============================================================================

/**
 * Get or create tour progress for a user.
 */
export async function getTourProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  tourCompleted: boolean;
  tourDismissed: boolean;
  currentStep: string;
  stepsCompleted: Record<string, string>;
  activeTour: string;
  toursDismissed: string[];
  tourVoiceEnabled: boolean;
}> {
  const { data: existing } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return {
      tourCompleted: existing.tour_completed,
      tourDismissed: existing.tour_dismissed,
      currentStep: existing.current_step,
      stepsCompleted: existing.steps_completed || {},
      activeTour: existing.active_tour,
      toursDismissed: existing.tours_dismissed || [],
      tourVoiceEnabled: existing.tour_voice_enabled,
    };
  }

  // Create for new user
  await supabase
    .from('onboarding_progress')
    .insert({ user_id: userId });

  return {
    tourCompleted: false,
    tourDismissed: false,
    currentStep: 'welcome',
    stepsCompleted: {},
    activeTour: 'first_visit',
    toursDismissed: [],
    tourVoiceEnabled: true,
  };
}

/**
 * Advance to the next tour step.
 */
export async function advanceTourStep(
  supabase: SupabaseClient,
  userId: string,
  completedStepId: string,
  tourId: string = 'first_visit'
): Promise<{ nextStep: TourStep | null; tourComplete: boolean }> {
  const tour = TOURS[tourId];
  if (!tour) return { nextStep: null, tourComplete: true };

  const currentIndex = tour.steps.findIndex(s => s.id === completedStepId);
  const nextIndex = currentIndex + 1;

  const isComplete = nextIndex >= tour.steps.length;
  const nextStep = isComplete ? null : tour.steps[nextIndex];

  // Update progress
  const progress = await getTourProgress(supabase, userId);
  const stepsCompleted = { ...progress.stepsCompleted, [completedStepId]: new Date().toISOString() };

  await supabase
    .from('onboarding_progress')
    .update({
      steps_completed: stepsCompleted,
      current_step: isComplete ? 'complete' : nextStep!.id,
      tour_completed: isComplete ? true : progress.tourCompleted,
      tour_completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq('user_id', userId);

  return { nextStep, tourComplete: isComplete };
}

/**
 * Dismiss a tour. User won't see it again.
 */
export async function dismissTour(
  supabase: SupabaseClient,
  userId: string,
  tourId: string = 'first_visit'
): Promise<void> {
  const progress = await getTourProgress(supabase, userId);
  const dismissed = [...(progress.toursDismissed || []), tourId];

  await supabase
    .from('onboarding_progress')
    .update({
      tour_dismissed: tourId === 'first_visit' ? true : progress.tourDismissed,
      tours_dismissed: dismissed,
    })
    .eq('user_id', userId);
}

/**
 * Check if a specific tour should be shown to the user.
 */
export async function shouldShowTour(
  supabase: SupabaseClient,
  userId: string,
  tourId: string
): Promise<boolean> {
  const progress = await getTourProgress(supabase, userId);

  // Already dismissed this specific tour
  if (progress.toursDismissed.includes(tourId)) return false;

  // First visit tour: only if never completed
  if (tourId === 'first_visit' && (progress.tourCompleted || progress.tourDismissed)) return false;

  return true;
}

/**
 * Start a specific tour (e.g., control panel tour).
 */
export async function startTour(
  supabase: SupabaseClient,
  userId: string,
  tourId: string
): Promise<TourDefinition | null> {
  const tour = TOURS[tourId];
  if (!tour) return null;

  await supabase
    .from('onboarding_progress')
    .upsert({
      user_id: userId,
      active_tour: tourId,
      current_step: tour.steps[0].id,
      last_tour_offered: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return tour;
}

/**
 * Get all available tours and their status for a user.
 */
export async function getAvailableTours(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<{ id: string; name: string; description: string; status: 'available' | 'completed' | 'dismissed' }>> {
  const progress = await getTourProgress(supabase, userId);

  return Object.values(TOURS).map(tour => ({
    id: tour.id,
    name: tour.name,
    description: tour.description,
    status: progress.toursDismissed.includes(tour.id)
      ? 'dismissed'
      : (tour.id === 'first_visit' && progress.tourCompleted)
        ? 'completed'
        : 'available',
  }));
}
// FILE: src/lib/onboarding/tour.ts
// Guided Tour Engine — v2.0
//
// Sprint E → F: Oracle-guided walkthrough for new users.
// Refactored from single linear flow to event-driven chained tours.
//
// 3 CHAINED TOURS (event-driven):
//   welcome_intro    — Dashboard: Oracle intro + user picks first task (choice step)
//   first_scan       — Scanner:  Quick button overview, suggests coin from pocket
//   first_results    — Results:  Oracle walks through first analysis
//
// STANDALONE TOURS (triggered from settings):
//   control_panel    — Settings: privacy, autonomy, Oracle prefs, notifications
//
// EVENT FLOW:
//   Onboarding modal completes → Dashboard loads → welcome_intro starts
//   User picks "Scan something" → scanner opens → first_scan starts
//   User completes scan → results appear → first_results starts
//   (Any choice in welcome_intro is valid — only scanner triggers first_scan)
//
// PHILOSOPHY:
//   - Tours are conversational, not instructional
//   - Oracle speaks AS the guide — it's a friend, not a tooltip
//   - "Skip tour" + "Don't show again" always available
//   - {{screenName}} placeholder replaced at render time
//   - No condescension — helpful without being patronizing
//   - Tours can be re-accessed from settings
//
// DATA-TOUR ATTRIBUTES NEEDED:
//   Dashboard:
//     data-tour="scan-result"              → AnalysisResult wrapper div (already exists)
//
//   AppLayout / Bottom Nav:
//     data-tour="scanner-button"           → Scanner FAB or nav tab
//     data-tour="vault-tab"                → Vault nav tab
//     data-tour="oracle-tab"               → Oracle chat nav tab
//
//   DualScanner:
//     data-tour="camera-trigger"           → Capture/shutter button (already exists)
//     data-tour="scanner-mode-toggle"      → Photo/Barcode mode toggle buttons
//     data-tour="scanner-controls-row"     → Footer controls row (flip, focus, upload, etc.)
//     data-tour="scanner-settings-cog"     → Settings gear button in header
//
//   Settings/Profile:
//     data-tour="oracle-preferences"       → Oracle prefs section
//     data-tour="privacy-settings"         → Privacy settings section
//     data-tour="notification-settings"    → Notifications section
//     data-tour="autonomy-settings"        → Autonomy controls
//     data-tour="vault-type-settings"      → Vault type selector

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface TourChoice {
  id: string;
  label: string;
  description: string;
  icon: string;                  // Emoji or icon name
  action: 'open_scanner' | 'navigate' | 'next_step';
  navigateTo?: string;           // Route path for navigate action
  triggersTour?: string;         // Tour ID that starts after this choice
}

export interface TourStep {
  id: string;
  title: string;
  transcript: string;            // What Oracle says — supports {{screenName}}
  voiceClipUrl?: string;         // Pre-recorded audio URL (zero latency)
  targetSelector?: string;       // CSS selector to highlight (undefined = center overlay)
  targetPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;     // px around target element
  advanceOn: 'click' | 'next_button' | 'auto' | 'scan_complete' | 'action' | 'choice';
  autoAdvanceMs?: number;        // If advanceOn is 'auto'
  showSkip: boolean;
  illustration?: string;         // Optional image/animation URL
  choices?: TourChoice[];        // For choice steps
}

export interface TourDefinition {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  estimatedDurationSec: number;
  canDismiss: boolean;
  triggeredBy: 'auto' | 'event' | 'manual';  // How this tour starts
  triggerEvent?: string;                       // CustomEvent name that starts this tour
}

// =============================================================================
// TOUR DEFINITIONS
// =============================================================================

export const TOURS: Record<string, TourDefinition> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // WELCOME INTRO — Dashboard, right after onboarding modal
  // Oracle introduces itself, user picks their first task
  // ═══════════════════════════════════════════════════════════════════════════
  welcome_intro: {
    id: 'welcome_intro',
    name: 'Meet Your Oracle',
    description: 'Your Oracle introduces itself and helps you take your first step',
    estimatedDurationSec: 30,
    canDismiss: true,
    triggeredBy: 'auto',
    steps: [
      {
        id: 'oracle_greeting',
        title: 'Meet Your Oracle',
        transcript: "Hi {{screenName}} — I'm your TagnetIQ Oracle. I'm here to be your assistant, your market expert, and honestly, your secret weapon. I can identify almost anything, tell you what it's worth, and track your collection. And that's just on this tier — wait until you see what I can really do.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: true,
        illustration: undefined,
      },
      {
        id: 'first_task_choice',
        title: "What's First?",
        transcript: "To get you familiar with the app, what would you like to do first? Pick one — you can explore everything else after.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'choice',
        showSkip: true,
        choices: [
          {
            id: 'choice_scan',
            label: 'Scan an item',
            description: 'Point your camera at anything and I\'ll identify it',
            icon: '📷',
            action: 'open_scanner',
            triggersTour: 'first_scan',
          },
          {
            id: 'choice_marketplace',
            label: 'Browse the marketplace',
            description: 'See what other collectors are buying and selling',
            icon: '🏪',
            action: 'navigate',
            navigateTo: '/arena/marketplace',
          },
          {
            id: 'choice_settings',
            label: 'Set up my profile',
            description: 'Customize your Oracle, privacy, and notifications',
            icon: '⚙️',
            action: 'navigate',
            navigateTo: '/profile',
            triggersTour: 'control_panel',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRST SCAN — Scanner, triggers when scanner opens for the first time
  // Quick tour of all scanner buttons, suggests scanning a coin
  // ═══════════════════════════════════════════════════════════════════════════
  first_scan: {
    id: 'first_scan',
    name: 'Scanner Tour',
    description: 'Quick overview of your scanner controls',
    estimatedDurationSec: 25,
    canDismiss: true,
    triggeredBy: 'event',
    triggerEvent: 'tagnetiq:scanner-opened',
    steps: [
      {
        id: 'scanner_welcome',
        title: 'Your Scanner',
        transcript: "This is your scanner — it's got a lot packed in. Let me give you the quick version.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'scanner_modes',
        title: 'Scan Modes',
        transcript: "These toggle between Photo mode and Barcode mode. Photo mode uses AI vision to identify anything you point at. Barcode mode reads UPC, ISBN, and QR codes for instant database lookups. Both are powerful — use whichever fits.",
        targetSelector: '[data-tour="scanner-mode-toggle"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'scanner_controls',
        title: 'Camera Controls',
        transcript: "Down here are your tools — flip the camera, tap to focus, upload from your gallery, or scan a document. Everything you need is one tap away.",
        targetSelector: '[data-tour="scanner-controls-row"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'scanner_settings',
        title: 'Settings',
        transcript: "This gear opens your scanner settings — torch, grid overlay, and more. Worth exploring once you're comfortable.",
        targetSelector: '[data-tour="scanner-settings-cog"]',
        targetPosition: 'bottom',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'scanner_capture',
        title: 'Take the Shot',
        transcript: "And this is your trigger. Got a coin in your pocket? A book on the shelf? Anything works — point and tap. I'll handle the rest.",
        targetSelector: '[data-tour="camera-trigger"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: false,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRST RESULTS — Dashboard, triggers when first scan completes
  // Oracle walks through the analysis card
  // ═══════════════════════════════════════════════════════════════════════════
  first_results: {
    id: 'first_results',
    name: 'Your First Scan Results',
    description: 'Oracle explains what your scan results mean',
    estimatedDurationSec: 25,
    canDismiss: true,
    triggeredBy: 'event',
    triggerEvent: 'tagnetiq:first-scan-complete',
    steps: [
      {
        id: 'results_congrats',
        title: 'First Scan Complete!',
        transcript: "There we go, {{screenName}} — your first scan is in! Let me break down what you're looking at.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'results_overview',
        title: 'Your Analysis',
        transcript: "This is your analysis card. Everything I found — identification, estimated value, market data — is right here. I cross-referenced multiple AI models and real listings to build this.",
        targetSelector: '[data-tour="scan-result"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'results_authority',
        title: 'Data Sources',
        transcript: "When I can match your item to an authority database — like a coin catalog, book ISBN, or trading card registry — you'll see extra verified details. Not every item will match one, and that's perfectly fine. The AI identification still works.",
        targetSelector: '[data-tour="scan-result"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'results_next',
        title: 'What Next?',
        transcript: "From here you can save it to your vault, share it with someone, or scan something else. Every scan teaches me more about what you're interested in.",
        targetSelector: '[data-tour="scan-result"]',
        targetPosition: 'top',
        advanceOn: 'next_button',
        showSkip: true,
      },
      {
        id: 'results_done',
        title: "You're All Set",
        transcript: "That's the basics! You've got a scanner, a vault, a marketplace, and me. Go explore — I'll be right here when you need me.",
        targetSelector: undefined,
        targetPosition: 'center',
        advanceOn: 'next_button',
        showSkip: false,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL PANEL — Settings/Profile page
  // Triggered from settings or from welcome_intro choice
  // ═══════════════════════════════════════════════════════════════════════════
  control_panel: {
    id: 'control_panel',
    name: 'Your Control Panel',
    description: 'Customize your Oracle and privacy settings',
    estimatedDurationSec: 45,
    canDismiss: true,
    triggeredBy: 'manual',
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
        transcript: "Privacy is yours to control. Every conversation is private by default. You choose what to share, what to lock, and what to delete. I never share your data without your say-so.",
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
// TOUR CHAIN — defines which tours can follow which
// =============================================================================

export const TOUR_CHAIN: Record<string, string[]> = {
  welcome_intro: ['first_scan', 'control_panel'],  // These can be triggered after welcome
  first_scan: ['first_results'],                     // Results tour follows scan
  first_results: [],                                 // Terminal
  control_panel: [],                                 // Terminal
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
  toursCompleted: string[];
  tourVoiceEnabled: boolean;
}> {
  const { data: existing } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Derive toursCompleted from steps_completed
    const stepsCompleted = existing.steps_completed || {};
    const toursCompleted: string[] = [];
    for (const tourId of Object.keys(TOURS)) {
      const tour = TOURS[tourId];
      const lastStep = tour.steps[tour.steps.length - 1];
      if (stepsCompleted[lastStep.id]) {
        toursCompleted.push(tourId);
      }
    }

    return {
      tourCompleted: existing.tour_completed,
      tourDismissed: existing.tour_dismissed,
      currentStep: existing.current_step,
      stepsCompleted,
      activeTour: existing.active_tour,
      toursDismissed: existing.tours_dismissed || [],
      toursCompleted,
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
    currentStep: 'oracle_greeting',
    stepsCompleted: {},
    activeTour: 'welcome_intro',
    toursDismissed: [],
    toursCompleted: [],
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
  tourId: string = 'welcome_intro'
): Promise<{ nextStep: TourStep | null; tourComplete: boolean }> {
  const tour = TOURS[tourId];
  if (!tour) return { nextStep: null, tourComplete: true };

  const currentIndex = tour.steps.findIndex(s => s.id === completedStepId);
  const nextIndex = currentIndex + 1;

  const isComplete = nextIndex >= tour.steps.length;
  const nextStep = isComplete ? null : tour.steps[nextIndex];

  // Update progress
  const progress = await getTourProgress(supabase, userId);
  const stepsCompleted = {
    ...progress.stepsCompleted,
    [completedStepId]: new Date().toISOString(),
  };

  // Mark first_visit legacy flag if welcome_intro completes
  const isFirstVisitComplete =
    isComplete && (tourId === 'welcome_intro' || tourId === 'first_results');

  await supabase
    .from('onboarding_progress')
    .update({
      steps_completed: stepsCompleted,
      current_step: isComplete ? 'complete' : nextStep!.id,
      active_tour: isComplete ? tourId : progress.activeTour,
      tour_completed: isFirstVisitComplete ? true : progress.tourCompleted,
      tour_completed_at: isFirstVisitComplete ? new Date().toISOString() : null,
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
  tourId: string = 'welcome_intro'
): Promise<void> {
  const progress = await getTourProgress(supabase, userId);
  const dismissed = [...new Set([...(progress.toursDismissed || []), tourId])];

  await supabase
    .from('onboarding_progress')
    .update({
      tour_dismissed: tourId === 'welcome_intro' ? true : progress.tourDismissed,
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

  // Already completed this tour
  if (progress.toursCompleted.includes(tourId)) return false;

  // Legacy: first_visit completed means welcome_intro is done
  if (tourId === 'welcome_intro' && (progress.tourCompleted || progress.tourDismissed)) {
    return false;
  }

  return true;
}

/**
 * Start a specific tour (e.g., control panel tour from settings).
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
): Promise<Array<{
  id: string;
  name: string;
  description: string;
  status: 'available' | 'completed' | 'dismissed';
}>> {
  const progress = await getTourProgress(supabase, userId);

  return Object.values(TOURS).map(tour => ({
    id: tour.id,
    name: tour.name,
    description: tour.description,
    status: progress.toursDismissed.includes(tour.id)
      ? 'dismissed'
      : progress.toursCompleted.includes(tour.id)
        ? 'completed'
        : 'available',
  }));
}
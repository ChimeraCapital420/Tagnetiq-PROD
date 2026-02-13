// FILE: src/lib/onboarding/index.ts
// Onboarding + Engagement Module
//
// Sprint E: First impressions + retention mechanics

// ── Tour Engine ─────────────────────────────────────────
export {
  type TourStep,
  type TourDefinition,
  TOURS,
  getTourProgress,
  advanceTourStep,
  dismissTour,
  startTour,
  getAvailableTours,
  shouldShowTour,
} from './tour.js';

// ── Engagement (Share Prompts, Digest, Moments) ────────
export {
  type ShareTrigger,
  type DigestContent,
  getSharePrompt,
  trackShareResponse,
  buildDailyDigest,
  getCommunityMoments,
  suggestCommunityMoment,
  reactToMoment,
  detectMomentWorthy,
} from './engagement.js';
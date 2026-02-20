// FILE: src/features/boardroom/intelligence/client-router.ts
// Sprint 9: Client-Side Topic Detection & Routing Preview
//
// Mirrors expertise-router.ts logic but runs entirely on device.
// Shows which board member will respond BEFORE the user hits send.
// The server validates, but uses the client hint to skip its own
// detectTopic() + routeQuestion() calls when they match.
//
// Mobile-first: Runs on every keystroke (debounced) so the UI
// can show "Athena is typing..." before the message leaves the device.

import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface ClientRoutingPreview {
  /** Predicted primary responder */
  primarySlug: string | null;
  /** Predicted primary member's name (for UI) */
  primaryName: string;
  /** Detected topic */
  topic: string;
  /** Confidence 0-1 */
  confidence: number;
  /** Supporting members (slugs) */
  supporting: string[];
  /** Why this routing was chosen */
  reason: string;
  /** Timestamp for freshness check */
  timestamp: number;
}

// =============================================================================
// TOPIC KEYWORDS — mirrors expertise-router.ts (keep in sync)
// =============================================================================

const TOPIC_KEYWORDS: Record<string, string[]> = {
  finance: [
    'revenue', 'cost', 'budget', 'pricing', 'margin', 'p&l', 'financial',
    'roi', 'subscription', 'stripe', 'cash flow', 'fundraising', 'valuation',
    'unit economics', 'runway', 'burn rate', 'profit', 'loss', 'tax',
    'capital', 'investor', 'equity', 'debt', 'payment',
  ],
  technology: [
    'api', 'database', 'code', 'deploy', 'bug', 'feature', 'server',
    'frontend', 'backend', 'architecture', 'scaling', 'performance',
    'integration', 'devops', 'cloud', 'aws', 'vercel', 'react',
    'typescript', 'supabase', 'infrastructure', 'migration',
  ],
  marketing: [
    'brand', 'campaign', 'social media', 'content', 'seo', 'growth',
    'viral', 'community', 'engagement', 'followers', 'influencer',
    'advertising', 'funnel', 'conversion', 'acquisition', 'retention',
    'newsletter', 'email', 'launch', 'positioning',
  ],
  strategy: [
    'strategy', 'competitive', 'market position', 'long term', 'vision',
    'roadmap', 'pivot', 'expansion', 'opportunity', 'threat',
    'disruption', 'moat', 'differentiation', 'okr', 'kpi',
    'milestone', 'goal', 'objective', 'planning',
  ],
  operations: [
    'process', 'workflow', 'inventory', 'shipping', 'logistics',
    'automation', 'efficiency', 'bottleneck', 'supply chain',
    'warehouse', 'fulfillment', 'optimization', 'sop',
    'quality control', 'throughput', 'capacity',
  ],
  legal: [
    'legal', 'compliance', 'terms', 'privacy', 'gdpr', 'contract',
    'liability', 'trademark', 'copyright', 'patent', 'regulation',
    'policy', 'tos', 'dispute', 'lawsuit', 'agreement',
    'intellectual property', 'authentication',
  ],
  security: [
    'security', 'fraud', 'hack', 'breach', 'encrypt', 'auth',
    'verification', 'trust', 'vulnerability', 'firewall',
    'penetration', 'audit', 'compliance', 'risk',
  ],
  innovation: [
    'innovation', 'ai', 'machine learning', 'prototype', 'experiment',
    'emerging', 'disruptive', 'patent', 'research', 'invention',
    'moonshot', 'future', 'next gen', 'cutting edge',
  ],
  people: [
    'hire', 'team', 'culture', 'talent', 'onboarding', 'retention',
    'performance review', 'compensation', 'benefits', 'morale',
    'leadership', 'training', 'diversity', 'remote',
    'org structure', 'recruiting',
  ],
  data: [
    'data', 'analytics', 'metrics', 'dashboard', 'report',
    'insight', 'trend', 'forecast', 'model', 'algorithm',
    'visualization', 'tracking', 'measurement',
  ],
  product: [
    'product', 'feature', 'user experience', 'ux', 'ui', 'design',
    'roadmap', 'backlog', 'sprint', 'release', 'beta',
    'feedback', 'testing', 'usability', 'customer',
  ],
  wellness: [
    'burnout', 'stress', 'health', 'balance', 'wellbeing',
    'sustainable', 'energy', 'motivation', 'mindset',
    'overwhelmed', 'exhausted', 'break', 'rest',
  ],
  knowledge: [
    'documentation', 'knowledge base', 'wiki', 'learning',
    'training', 'best practices', 'standards', 'playbook',
    'reference', 'guide', 'tutorial', 'onboarding',
  ],
  partnerships: [
    'partnership', 'affiliate', 'referral', 'collaboration',
    'alliance', 'integration', 'deal', 'joint venture',
    'reseller', 'channel', 'distribution',
  ],
};

// =============================================================================
// TOPIC → MEMBER SLUG MAPPING (matches expertise-router.ts)
// =============================================================================

const TOPIC_TO_MEMBER: Record<string, string> = {
  finance: 'griffin',
  technology: 'vulcan',
  marketing: 'glitch',
  strategy: 'athena',
  operations: 'sal',
  legal: 'lexicoda',
  security: 'sha1',       // SHA-1 handles security + partnerships
  innovation: 'leo',
  people: 'cerebro',
  data: 'scuba',
  product: 'legolas',
  wellness: 'aegle',       // Prometheus for psychology, Aegle for wellness
  knowledge: 'orion',
  partnerships: 'sha1',
};

// =============================================================================
// DETECTION
// =============================================================================

/**
 * Detect topic from message — runs on device.
 * Returns the detected topic and confidence.
 */
export function detectClientTopic(message: string): { topic: string; confidence: number; matches: number } {
  const lower = message.toLowerCase();
  let bestTopic = 'general';
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  const confidence = bestScore === 0
    ? 0.2
    : Math.min(0.95, 0.4 + bestScore * 0.12);

  return { topic: bestTopic, confidence, matches: bestScore };
}

/**
 * Preview which member will respond — runs on device.
 * Shows routing prediction in UI before the message is sent.
 */
export function previewRouting(
  message: string,
  members: BoardMember[],
  meetingType?: string,
  participantSlugs?: string[],
): ClientRoutingPreview {
  // For full_board or vote, all members respond — no routing needed
  if (meetingType === 'full_board' || meetingType === 'vote') {
    return {
      primarySlug: null,
      primaryName: 'Full Board',
      topic: 'general',
      confidence: 1,
      supporting: members.map(m => m.slug),
      reason: 'Full board meeting — all members respond',
      timestamp: Date.now(),
    };
  }

  // For 1:1, the participant is already selected
  if (meetingType === 'one_on_one' && participantSlugs?.length === 1) {
    const topic = detectClientTopic(message);
    const member = members.find(m => m.slug === participantSlugs[0]);
    return {
      primarySlug: participantSlugs[0],
      primaryName: member?.name || participantSlugs[0],
      topic: topic.topic,
      confidence: 1,
      supporting: [],
      reason: `1:1 session with ${member?.name || 'member'}`,
      timestamp: Date.now(),
    };
  }

  // For committee or unstructured, route by topic
  const { topic, confidence, matches } = detectClientTopic(message);
  const primarySlug = TOPIC_TO_MEMBER[topic] || 'athena'; // default to strategy

  // Filter to available members (in meeting participants if set)
  const available = participantSlugs?.length
    ? members.filter(m => participantSlugs.includes(m.slug))
    : members;

  const primary = available.find(m => m.slug === primarySlug) || available[0];

  // Find supporting members — those whose expertise overlaps
  const supporting = available
    .filter(m => m.slug !== primary?.slug)
    .filter(m => {
      // Check if member has expertise keywords matching the topic
      const expertiseText = (m.expertise || []).join(' ').toLowerCase();
      const topicKeywords = TOPIC_KEYWORDS[topic] || [];
      return topicKeywords.some(k => expertiseText.includes(k));
    })
    .slice(0, 2) // max 2 supporting
    .map(m => m.slug);

  return {
    primarySlug: primary?.slug || null,
    primaryName: primary?.name || 'Board',
    topic,
    confidence,
    supporting,
    reason: matches > 0
      ? `Topic: ${topic} (${matches} keywords matched) → ${primary?.name}`
      : `No strong topic detected → defaulting to ${primary?.name}`,
    timestamp: Date.now(),
  };
}
// FILE: src/lib/boardroom/expertise-router.ts
// Sprint 8: Expertise-Based Question Router
//
// When a user asks a question to the board, this routes it to
// the member(s) best suited to answer. Uses:
//   1. Oracle's keyword-based expertise detection (energy.ts patterns)
//   2. Board member domain mapping (evolution.ts isCrossDomain)
//   3. Trust-weighted scoring — higher trust = more routing preference
//   4. Energy awareness — don't overload active members
//
// Mobile-first: lightweight enough to run per-message.
// No external API calls — pure heuristic routing.

import type { BoardMember } from './evolution.js';
import { isCrossDomain } from './evolution.js';
import { getTrustTier, type TrustTier } from './board-trust.js';
import type { EnergyLevel } from '../../components/oracle/types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RoutingResult {
  /** Primary member to handle this question */
  primary: ScoredMember;
  /** Supporting members who could contribute */
  supporting: ScoredMember[];
  /** Detected topic category */
  topic: string;
  /** Why this routing was chosen */
  reasoning: string;
  /** Confidence in the routing (0-1) */
  confidence: number;
}

export interface ScoredMember {
  slug: string;
  name: string;
  title: string;
  score: number;
  reasons: string[];
  trustTier: TrustTier;
  inDomain: boolean;
}

// =============================================================================
// TOPIC DETECTION
// =============================================================================

/** Topic keywords mapped to board roles */
const TOPIC_SIGNALS: Record<string, { keywords: string[]; roles: string[] }> = {
  finance: {
    keywords: [
      'revenue', 'profit', 'pricing', 'budget', 'fundraise', 'runway',
      'cash flow', 'burn rate', 'valuation', 'investors', 'roi', 'margin',
      'cost', 'expense', 'financial', 'accounting', 'tax', 'p&l',
      'subscription', 'mrr', 'arr', 'ltv', 'cac', 'unit economics',
    ],
    roles: ['CFO'],
  },
  technology: {
    keywords: [
      'architecture', 'code', 'deploy', 'server', 'api', 'database',
      'performance', 'bug', 'feature', 'technical', 'infrastructure',
      'devops', 'ci/cd', 'testing', 'scalability', 'microservice',
      'frontend', 'backend', 'mobile', 'react', 'typescript', 'node',
    ],
    roles: ['CTO'],
  },
  marketing: {
    keywords: [
      'brand', 'marketing', 'growth', 'acquisition', 'content', 'social',
      'campaign', 'launch', 'audience', 'engagement', 'funnel', 'conversion',
      'seo', 'ads', 'influencer', 'community', 'newsletter', 'viral',
      'positioning', 'messaging', 'go-to-market', 'gtm',
    ],
    roles: ['CMO'],
  },
  strategy: {
    keywords: [
      'strategy', 'competitive', 'market', 'positioning', 'pivot',
      'expansion', 'partnership', 'acquisition', 'merger', 'roadmap',
      'okr', 'vision', 'mission', 'moat', 'differentiation',
      'disruption', 'first mover', 'market entry', 'blue ocean',
    ],
    roles: ['CSO'],
  },
  operations: {
    keywords: [
      'operations', 'process', 'efficiency', 'workflow', 'automation',
      'logistics', 'supply chain', 'quality', 'kpi', 'dashboard',
      'metrics', 'health', 'reliability', 'uptime', 'sla',
    ],
    roles: ['COO'],
  },
  legal: {
    keywords: [
      'legal', 'compliance', 'contract', 'ip', 'patent', 'trademark',
      'copyright', 'regulation', 'liability', 'terms', 'privacy',
      'gdpr', 'ccpa', 'tos', 'license', 'dispute', 'lawsuit',
    ],
    roles: ['Legal'],
  },
  security: {
    keywords: [
      'security', 'fraud', 'authentication', 'encryption', 'breach',
      'vulnerability', 'penetration', 'audit', 'access control',
      'zero trust', 'mfa', 'sso', 'rbac', 'compliance', 'risk',
    ],
    roles: ['CISO'],
  },
  innovation: {
    keywords: [
      'innovation', 'r&d', 'experiment', 'prototype', 'emerging',
      'ai', 'machine learning', 'blockchain', 'web3', 'ar', 'vr',
      'future', 'trend', 'disruption', 'moonshot', 'beta',
    ],
    roles: ['CIO'],
  },
  people: {
    keywords: [
      'hiring', 'team', 'culture', 'onboarding', 'retention',
      'hr', 'talent', 'compensation', 'benefits', 'performance review',
      'employee', 'remote', 'communication', 'leadership', 'management',
    ],
    roles: ['CHRO'],
  },
  data: {
    keywords: [
      'data', 'analytics', 'metrics', 'database', 'sql', 'dashboard',
      'reporting', 'warehouse', 'etl', 'pipeline', 'ml model',
      'prediction', 'segmentation', 'cohort', 'a/b test',
    ],
    roles: ['CDO'],
  },
  intelligence: {
    keywords: [
      'competitive intelligence', 'market research', 'trend analysis',
      'prediction', 'forecast', 'scenario', 'simulation', 'pattern',
      'signal', 'indicator', 'historical', 'cycle',
    ],
    roles: ['Research'],
  },
  product: {
    keywords: [
      'product', 'feature', 'user experience', 'ux', 'ui', 'design',
      'prototype', 'mvp', 'user feedback', 'iteration', 'sprint',
      'backlog', 'prioritization', 'roadmap', 'release',
    ],
    roles: ['Product'],
  },
  wellness: {
    keywords: [
      'burnout', 'wellness', 'health', 'sustainable', 'work-life',
      'stress', 'overwhelm', 'energy', 'motivation', 'morale',
      'founder health', 'mental health', 'self-care',
    ],
    roles: ['Psychology'],
  },
};

/**
 * Detect the primary topic of a message.
 * Returns the topic with the most keyword matches.
 */
export function detectTopic(message: string): { topic: string; confidence: number; matches: number } {
  const lower = message.toLowerCase();
  let bestTopic = 'general';
  let bestMatches = 0;

  for (const [topic, config] of Object.entries(TOPIC_SIGNALS)) {
    const matches = config.keywords.filter((k) => lower.includes(k)).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      bestTopic = topic;
    }
  }

  // Confidence based on match density
  const wordCount = message.split(/\s+/).length;
  const confidence = bestMatches > 0
    ? Math.min(1, bestMatches / Math.max(wordCount * 0.1, 1))
    : 0.1;

  return { topic: bestTopic, confidence, matches: bestMatches };
}

// =============================================================================
// MEMBER SCORING
// =============================================================================

/**
 * Score each board member for a given message.
 * Factors: domain match, trust level, energy/availability, expertise depth.
 */
export function scoreMember(
  member: BoardMember,
  topic: string,
  topicConfidence: number,
): ScoredMember {
  let score = 0;
  const reasons: string[] = [];
  const inDomain = !isCrossDomain(member, topic);
  const trustTier = getTrustTier(member.trust_level);

  // Domain match (biggest factor)
  if (inDomain) {
    score += 40;
    reasons.push('Primary domain match');
  }

  // Expertise keyword overlap
  const expertiseMatch = member.expertise.some((e) =>
    e.toLowerCase().includes(topic) || topic.includes(e.toLowerCase().split(' ')[0])
  );
  if (expertiseMatch) {
    score += 20;
    reasons.push('Expertise alignment');
  }

  // Trust bonus — higher trust = more reliable answers
  score += Math.min(20, member.trust_level * 0.2);
  if (member.trust_level >= 60) {
    reasons.push(`Trust: ${trustTier}`);
  }

  // Experience bonus — more interactions = more context
  const experienceBonus = Math.min(10, member.total_interactions * 0.05);
  score += experienceBonus;

  // Cross-domain versatility bonus
  if (!inDomain && member.cross_domain_assists > 5) {
    score += 5;
    reasons.push('Cross-domain track record');
  }

  // Energy penalty — don't overload active members
  const energyPenalty = getEnergyPenalty(member.current_energy as EnergyLevel);
  score -= energyPenalty;

  // Confidence multiplier
  score *= (0.5 + topicConfidence * 0.5);

  return {
    slug: member.slug,
    name: member.name,
    title: member.title,
    score: Math.round(score * 10) / 10,
    reasons,
    trustTier,
    inDomain,
  };
}

// =============================================================================
// MAIN ROUTER
// =============================================================================

/**
 * Route a user message to the best board member(s).
 * Returns primary + supporting members with scores and reasoning.
 */
export function routeQuestion(
  message: string,
  members: BoardMember[],
  options?: {
    /** Exclude specific members (e.g., already speaking) */
    excludeSlugs?: string[];
    /** Force a specific member (for 1:1 conversations) */
    forceMember?: string;
    /** Maximum supporting members to return */
    maxSupporting?: number;
  },
): RoutingResult {
  const {
    excludeSlugs = [],
    forceMember,
    maxSupporting = 3,
  } = options || {};

  // If forced member, short-circuit
  if (forceMember) {
    const member = members.find((m) => m.slug === forceMember);
    if (member) {
      const topic = detectTopic(message);
      const scored = scoreMember(member, topic.topic, topic.confidence);
      return {
        primary: scored,
        supporting: [],
        topic: topic.topic,
        reasoning: `Direct conversation with ${member.name}`,
        confidence: 1,
      };
    }
  }

  // Detect topic
  const { topic, confidence: topicConfidence } = detectTopic(message);

  // Score all eligible members
  const eligible = members.filter((m) => !excludeSlugs.includes(m.slug));
  const scored = eligible
    .map((m) => scoreMember(m, topic, topicConfidence))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      primary: {
        slug: 'athena',
        name: 'Athena',
        title: 'Chief Strategy Officer',
        score: 0,
        reasons: ['Default — no eligible members'],
        trustTier: 'observer',
        inDomain: false,
      },
      supporting: [],
      topic,
      reasoning: 'No eligible members found, defaulting to Athena',
      confidence: 0.1,
    };
  }

  const primary = scored[0];

  // Supporting: members with score > 50% of primary, different from primary
  const supportThreshold = primary.score * 0.5;
  const supporting = scored
    .slice(1)
    .filter((m) => m.score >= supportThreshold && m.score > 10)
    .slice(0, maxSupporting);

  // Build reasoning
  const reasoning = buildRoutingReasoning(primary, supporting, topic, topicConfidence);

  return {
    primary,
    supporting,
    topic,
    reasoning,
    confidence: topicConfidence,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getEnergyPenalty(energy: EnergyLevel): number {
  const penalties: Partial<Record<EnergyLevel, number>> = {
    frustrated: 5,
    tired: 3,
    overwhelmed: 8,
    crisis: 10,
  };
  return penalties[energy] || 0;
}

function buildRoutingReasoning(
  primary: ScoredMember,
  supporting: ScoredMember[],
  topic: string,
  confidence: number,
): string {
  const parts: string[] = [];

  parts.push(
    `Topic: ${topic} (confidence: ${Math.round(confidence * 100)}%)`
  );

  parts.push(
    `Primary: ${primary.name} (${primary.title}) — score ${primary.score}. ${primary.reasons.join(', ')}`
  );

  if (supporting.length > 0) {
    const supportNames = supporting.map(
      (m) => `${m.name} (${Math.round(m.score)})`
    );
    parts.push(`Supporting: ${supportNames.join(', ')}`);
  }

  return parts.join('. ');
}
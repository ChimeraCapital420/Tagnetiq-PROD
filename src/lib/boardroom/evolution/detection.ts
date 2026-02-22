// FILE: src/lib/boardroom/evolution/detection.ts
// ═══════════════════════════════════════════════════════════════════════
// CROSS-DOMAIN & TOPIC DETECTION
// ═══════════════════════════════════════════════════════════════════════
//
// Detects whether a member is operating outside their domain
// and classifies conversation topics for DNA tracking.
//
// ═══════════════════════════════════════════════════════════════════════

import type { BoardMember } from './types.js';

// ============================================================================
// DOMAIN MAP — Which topics belong to which role
// ============================================================================

const DOMAIN_MAP: Record<string, string[]> = {
  CFO: ['finance', 'revenue', 'pricing', 'budget', 'accounting', 'fundraising'],
  CTO: ['architecture', 'code', 'technical', 'infrastructure', 'engineering', 'devops'],
  CMO: ['marketing', 'brand', 'growth', 'content', 'acquisition', 'social'],
  COO: ['operations', 'process', 'efficiency', 'health', 'performance', 'reliability'],
  CSO: ['strategy', 'competitive', 'planning', 'positioning', 'market'],
  Legal: ['legal', 'compliance', 'contracts', 'ip', 'regulatory', 'risk'],
  CISO: ['security', 'fraud', 'trust', 'verification', 'encryption', 'privacy'],
  CIO: ['innovation', 'research', 'emerging', 'experimentation', 'future'],
  CHRO: ['hr', 'culture', 'communications', 'support', 'community', 'feedback'],
  CKO: ['knowledge', 'research', 'documentation', 'learning', 'information'],
  CDO: ['data', 'analytics', 'metrics', 'database', 'ml', 'quality'],
  CSciO: ['science', 'experiment', 'methodology', 'hypothesis', 'analysis'],
  Research: ['research', 'investigation', 'deep-dive', 'discovery'],
  Product: ['product', 'ux', 'features', 'roadmap', 'user-experience'],
  Psychology: ['psychology', 'behavior', 'motivation', 'mental-health', 'cognitive'],
};

// ============================================================================
// TOPIC PATTERNS — Regex-based topic classification
// ============================================================================

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/\b(revenue|cost|budget|pricing|margin|p[&]l|financial|roi|subscription|stripe)\b/i, 'finance'],
  [/\b(security|fraud|hack|breach|encrypt|auth|verification|trust)\b/i, 'security'],
  [/\b(strateg|competi|market position|long.?term|vision|pivot)\b/i, 'strategy'],
  [/\b(code|bug|deploy|api|refactor|architect|infra|database)\b/i, 'technical'],
  [/\b(market|brand|growth|campaign|seo|social|content|acquisition)\b/i, 'marketing'],
  [/\b(legal|compliance|contract|ip|patent|regulat|terms|privacy)\b/i, 'legal'],
  [/\b(hire|team|culture|onboard|performance review|hr)\b/i, 'hr'],
  [/\b(data|analytics|metric|dashboard|ml|model|pipeline)\b/i, 'data'],
  [/\b(product|feature|ux|roadmap|user experience|design)\b/i, 'product'],
  [/\b(research|investigat|deep.?dive|analysis|study)\b/i, 'research'],
  [/\b(science|experiment|hypothesis|method|test)\b/i, 'science'],
  [/\b(innovat|emerging|future|ai|blockchain|trend)\b/i, 'innovation'],
  [/\b(operat|process|efficien|uptime|health|monitor)\b/i, 'operations'],
  [/\b(psycholog|behavior|motivat|cognitiv|mental)\b/i, 'psychology'],
];

// ============================================================================
// EXPORTS
// ============================================================================

export function isCrossDomain(member: BoardMember, topicCategory: string): boolean {
  const memberDomains = DOMAIN_MAP[member.role] || [];
  const topic = topicCategory.toLowerCase();
  return !memberDomains.some(d => topic.includes(d));
}

export function detectTopicCategory(message: string): string {
  for (const [pattern, category] of TOPIC_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  return 'general';
}
// FILE: src/lib/oracle/personality/energy.ts
// Deep Energy Detection — replaces keyword-only approach with multi-signal analysis
// Tracks conversation arcs, not just single messages
// Also detects user expertise level from language patterns
// Mobile-first: all processing happens at call time, no external APIs

import type { EnergyLevel, EnergyArc, ExpertiseLevel } from '../../../components/oracle/types.js';

// =============================================================================
// SINGLE MESSAGE ENERGY
// =============================================================================

interface EnergySignals {
  exclamationDensity: number;
  questionDensity: number;
  capsRatio: number;
  emojiCount: number;
  messageLength: number;
  profanityPresent: boolean;
  ellipsisDensity: number;
  sentimentKeywords: { positive: number; negative: number; focused: number; curious: number };
}

export function detectEnergy(message: string): EnergyLevel {
  const signals = analyzeSignals(message);

  // High exclamation + positive keywords → excited
  if (signals.exclamationDensity > 0.03 && signals.sentimentKeywords.positive > 0) {
    return 'excited';
  }

  // ALL CAPS with some length → excited or frustrated (check sentiment)
  if (signals.capsRatio > 0.5 && message.length > 10) {
    return signals.sentimentKeywords.negative > 0 ? 'frustrated' : 'excited';
  }

  // Profanity or strong negative keywords → frustrated
  if (signals.profanityPresent || signals.sentimentKeywords.negative >= 2) {
    return 'frustrated';
  }

  // Short message with question mark → focused
  if (message.length < 50 && signals.questionDensity > 0) {
    return 'focused';
  }

  // Many questions → curious
  if (signals.questionDensity > 0.02 || signals.sentimentKeywords.curious > 0) {
    return 'curious';
  }

  // Emoji usage, casual language → casual
  if (signals.emojiCount > 0 || (signals.profanityPresent && signals.sentimentKeywords.negative === 0)) {
    return 'casual';
  }

  // Ellipsis heavy → uncertainty, which maps to focused (thinking mode)
  if (signals.ellipsisDensity > 0.02) {
    return 'focused';
  }

  return 'neutral';
}

function analyzeSignals(message: string): EnergySignals {
  const len = message.length || 1;
  const words = message.split(/\s+/).filter(Boolean);

  // Exclamation density
  const exclamations = (message.match(/!/g) || []).length;

  // Question density
  const questions = (message.match(/\?/g) || []).length;

  // CAPS ratio (only letters)
  const letters = message.replace(/[^a-zA-Z]/g, '');
  const upperLetters = letters.replace(/[^A-Z]/g, '');
  const capsRatio = letters.length > 3 ? upperLetters.length / letters.length : 0;

  // Emoji count
  const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiCount = (message.match(emojiPattern) || []).length;

  // Profanity (light check — not exhaustive, just catches obvious signals)
  const profanityPattern = /\b(damn|shit|fuck|hell|crap|wtf|omfg|fml|bs)\b/i;
  const profanityPresent = profanityPattern.test(message);

  // Ellipsis density
  const ellipses = (message.match(/\.{3,}|…/g) || []).length;

  // Sentiment keywords
  const lowerMsg = message.toLowerCase();
  const sentimentKeywords = {
    positive: countMatches(lowerMsg, POSITIVE_KEYWORDS),
    negative: countMatches(lowerMsg, NEGATIVE_KEYWORDS),
    focused: countMatches(lowerMsg, FOCUSED_KEYWORDS),
    curious: countMatches(lowerMsg, CURIOUS_KEYWORDS),
  };

  return {
    exclamationDensity: exclamations / len,
    questionDensity: questions / len,
    capsRatio,
    emojiCount,
    messageLength: len,
    profanityPresent,
    ellipsisDensity: ellipses / len,
    sentimentKeywords,
  };
}

// =============================================================================
// CONVERSATION ARC TRACKING
// =============================================================================

/**
 * Analyze the arc of the last N messages to detect trajectory.
 * This tells Oracle HOW the conversation is moving, not just current state.
 */
export function detectEnergyArc(
  messages: Array<{ role: string; content: string }>,
  windowSize = 8,
): EnergyArc {
  const recent = messages
    .filter(m => m.role === 'user')
    .slice(-windowSize);

  if (recent.length < 2) return 'steady';

  const energies = recent.map(m => detectEnergy(m.content));

  // Check for patterns
  const lastThree = energies.slice(-3);
  const firstThree = energies.slice(0, 3);

  // Excitement building: early neutral/focused → late excited
  if (
    firstThree.some(e => ['neutral', 'focused', 'casual'].includes(e)) &&
    lastThree.some(e => e === 'excited')
  ) {
    return 'building_excitement';
  }

  // Losing interest: messages getting shorter, energy dropping
  const recentLengths = recent.map(m => m.content.length);
  const avgFirst = avg(recentLengths.slice(0, Math.ceil(recentLengths.length / 2)));
  const avgLast = avg(recentLengths.slice(Math.ceil(recentLengths.length / 2)));
  if (avgLast < avgFirst * 0.4 && recent.length >= 4) {
    return 'losing_interest';
  }

  // Problem solving: frustrated → focused → neutral/excited (recovery)
  if (
    energies.some(e => e === 'frustrated') &&
    lastThree.some(e => ['focused', 'neutral', 'excited'].includes(e))
  ) {
    return 'problem_solving';
  }

  // Venting: multiple frustrated messages in a row
  if (lastThree.filter(e => e === 'frustrated').length >= 2) {
    return 'venting';
  }

  // Celebrating: excited messages with win-related keywords
  const celebrationKeywords = /\b(found|got|scored|won|nailed|killed|crushed|amazing|deal|steal)\b/i;
  if (
    lastThree.includes('excited') &&
    recent.slice(-3).some(m => celebrationKeywords.test(m.content))
  ) {
    return 'celebrating';
  }

  // Learning: lots of questions
  const questionMessages = recent.filter(m => m.content.includes('?'));
  if (questionMessages.length > recent.length * 0.5) {
    return 'learning';
  }

  // Exploring: curious energy, varied topics
  if (lastThree.includes('curious')) {
    return 'exploring';
  }

  return 'steady';
}

// =============================================================================
// EXPERTISE DETECTION (from language patterns)
// =============================================================================

/**
 * Detect expertise level from a single message's language patterns.
 * Combines with scan count for more accurate assessment.
 */
export function detectExpertiseFromMessage(
  message: string,
  scanCount = 0,
): { level: ExpertiseLevel; indicators: string[] } {
  const lower = message.toLowerCase();
  const indicators: string[] = [];

  let score = 0;

  // Jargon usage
  if (EXPERT_JARGON.some(j => lower.includes(j))) {
    score += 3;
    indicators.push('Uses industry jargon');
  }

  // Mentions specific grading systems
  if (/\b(psa|bgs|sgc|cgc|pcgs|ngc|gem mint|near mint|vg|fg|ag)\b/i.test(message)) {
    score += 3;
    indicators.push('References grading systems');
  }

  // References specific platforms/marketplaces
  if (/\b(whatnot|mercari|poshmark|offerup|depop|stockx|goat|grailed|tcgplayer|cardmarket)\b/i.test(message)) {
    score += 2;
    indicators.push('Names specific platforms');
  }

  // Discusses margins, ROI, comps
  if (/\b(margin|roi|comps?|arv|flip|wholesale|arbitrage|sourcing|lot)\b/i.test(message)) {
    score += 3;
    indicators.push('Discusses business metrics');
  }

  // References condition descriptors
  if (/\b(mint|near mint|excellent|good|fair|poor|sealed|nib|mib|nwt|nwob|euc|guc|vguc)\b/i.test(message)) {
    score += 2;
    indicators.push('Uses condition terminology');
  }

  // Scan count factor
  if (scanCount > 100) { score += 3; indicators.push(`${scanCount} scans performed`); }
  else if (scanCount > 50) { score += 2; }
  else if (scanCount > 10) { score += 1; }

  // Map score to level
  let level: ExpertiseLevel;
  if (score >= 8) level = 'expert';
  else if (score >= 6) level = 'advanced';
  else if (score >= 4) level = 'intermediate';
  else if (score >= 2) level = 'learning';
  else level = 'newcomer';

  return { level, indicators };
}

// =============================================================================
// KEYWORD LISTS
// =============================================================================

const POSITIVE_KEYWORDS = [
  'awesome', 'amazing', 'love', 'wow', 'great', 'perfect', 'incredible',
  'jackpot', 'score', 'found', 'nice', 'beautiful', 'sick', 'fire',
  'dope', 'killer', 'sweet', 'yes', 'yess', 'lets go', 'deal',
  'steal', 'gem', 'treasure', 'mint', 'gorgeous',
];

const NEGATIVE_KEYWORDS = [
  'wrong', 'broken', 'stuck', 'confused', 'frustrated', 'annoyed',
  'terrible', 'awful', 'useless', 'waste', 'hate', 'sucks',
  'disappointed', 'lost', 'ruined', 'scam', 'fake', 'ripped off',
  'overpriced', 'damaged', 'missing', 'failed', 'error', 'bug',
];

const FOCUSED_KEYWORDS = [
  'specifically', 'exactly', 'precisely', 'need', 'looking for',
  'trying to', 'how much', 'what is', 'where can', 'when should',
];

const CURIOUS_KEYWORDS = [
  'wondering', 'curious', 'interesting', 'tell me', 'what about',
  'how does', 'why do', 'is there', 'have you', 'what if',
  'explore', 'discover', 'learn', 'explain', 'teach',
];

const EXPERT_JARGON = [
  'pop report', 'registry set', 'census', 'cert number', 'holder',
  'crossover', 'buyback', 'reholder', 'mechanical grade', 'eye appeal',
  'surface wear', 'die crack', 'doubled die', 'reverse proof',
  'raw vs graded', 'slab', 'cracked out', 'death pile', 'bolo',
  'shelf pull', 'store return', 'manifest', 'liquidation',
  'private label', 'ungated', 'restricted brand', 'prep center',
  'keepa', 'jungle scout', 'tactical arbitrage', 'seller central',
];

// =============================================================================
// HELPERS
// =============================================================================

function countMatches(text: string, keywords: string[]): number {
  return keywords.filter(k => text.includes(k)).length;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// FILE: src/features/boardroom/intelligence/client-energy.ts
// Sprint 9: Client-Side Energy Detection
//
// Mirrors board-energy.ts logic but runs entirely on device.
// Zero server cost. Zero latency. The server validates but trusts
// the client hint to skip its own detectMemberEnergy() call.
//
// Mobile-first: This runs on every keystroke (debounced) to show
// real-time energy indicators in the UI before the message is sent.

// =============================================================================
// TYPES (mirrors board-energy.ts — keep in sync)
// =============================================================================

export type ClientEnergyType =
  | 'excited'
  | 'frustrated'
  | 'focused'
  | 'curious'
  | 'casual'
  | 'neutral';

export interface ClientEnergyResult {
  energy: ClientEnergyType;
  confidence: number;    // 0-1
  signals: string[];     // what triggered this detection
  messageLength: number;
  timestamp: number;
}

export interface ClientRoomEnergyHint {
  /** User's detected energy */
  userEnergy: ClientEnergyType;
  /** Estimated engagement based on message frequency */
  engagement: 'active' | 'contributing' | 'listening' | 'idle';
  /** Estimated momentum from conversation flow */
  momentum: 'building' | 'peaked' | 'winding_down' | 'stalled';
  /** Time since last message (ms) */
  timeSinceLastMessage: number;
}

// =============================================================================
// ENERGY SIGNALS — same keywords as server, kept lightweight
// =============================================================================

const ENERGY_SIGNALS: Record<ClientEnergyType, string[]> = {
  excited: [
    'amazing', 'awesome', 'love', 'wow', 'incredible', 'fantastic',
    'perfect', 'brilliant', 'great idea', 'let\'s do it', 'game changer',
    'breakthrough', 'nailed it', 'exactly', 'yes!', 'this is it',
    'score', 'jackpot', 'found it',
  ],
  frustrated: [
    'wrong', 'broken', 'stuck', 'frustrated', 'confused', 'doesn\'t work',
    'failing', 'waste', 'terrible', 'impossible', 'ridiculous', 'annoyed',
    'why isn\'t', 'can\'t figure', 'keeps failing', 'still broken',
    'nothing works', 'give up',
  ],
  focused: [
    'specifically', 'exactly how', 'step by step', 'let\'s focus',
    'the key issue', 'priority', 'deadline', 'timeline', 'action items',
    'next steps', 'concrete', 'measurable', 'deliverable', 'sprint',
  ],
  curious: [
    'wondering', 'curious', 'what if', 'how does', 'why do',
    'have you considered', 'explore', 'interesting', 'tell me more',
    'could we', 'what about', 'is it possible', 'hypothetically',
  ],
  casual: [
    'hey', 'hi', 'hello', 'what\'s up', 'just checking', 'quick thought',
    'by the way', 'random question', 'off topic', 'anyway', 'so',
  ],
  neutral: [], // fallback — no specific signals
};

// =============================================================================
// DETECTION
// =============================================================================

/**
 * Detect energy from a message — runs on device, zero server cost.
 * Same signal matching as board-energy.ts but optimized for client.
 */
export function detectClientEnergy(message: string): ClientEnergyResult {
  const lower = message.toLowerCase().trim();
  const signals: string[] = [];
  let bestMatch: ClientEnergyType = 'neutral';
  let bestScore = 0;

  // Check each energy type for keyword matches
  for (const [energy, keywords] of Object.entries(ENERGY_SIGNALS) as [ClientEnergyType, string[]][]) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
        signals.push(`${energy}:${keyword}`);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = energy;
    }
  }

  // Heuristic boosts
  const exclamations = (message.match(/!/g) || []).length;
  const questions = (message.match(/\?/g) || []).length;
  const capsRatio = message.replace(/[^a-zA-Z]/g, '').length > 5
    ? message.replace(/[^A-Z]/g, '').length / message.replace(/[^a-zA-Z]/g, '').length
    : 0;

  // Exclamation marks boost excited/frustrated
  if (exclamations >= 2 && bestMatch === 'neutral') {
    bestMatch = 'excited';
    signals.push('heuristic:exclamations');
  }

  // ALL CAPS indicates strong emotion
  if (capsRatio > 0.5 && message.length > 10) {
    if (bestMatch === 'frustrated') {
      signals.push('heuristic:caps_frustrated');
    } else {
      bestMatch = bestMatch === 'neutral' ? 'excited' : bestMatch;
      signals.push('heuristic:caps_emphasis');
    }
  }

  // Long messages with questions → curious or deep_analysis
  if (message.length > 200 && questions >= 2 && bestMatch === 'neutral') {
    bestMatch = 'curious';
    signals.push('heuristic:long_with_questions');
  }

  // Short direct messages → focused
  if (message.length < 80 && message.length > 10 && bestMatch === 'neutral') {
    bestMatch = 'focused';
    signals.push('heuristic:short_direct');
  }

  // Calculate confidence
  const confidence = bestScore === 0
    ? 0.3  // heuristic only
    : Math.min(0.95, 0.5 + bestScore * 0.15);

  return {
    energy: bestMatch,
    confidence,
    signals,
    messageLength: message.length,
    timestamp: Date.now(),
  };
}

// =============================================================================
// ROOM ENERGY ESTIMATION
// =============================================================================

/**
 * Estimate room-level energy hints from client-side conversation state.
 * Helps the server skip room energy detection on cache hit.
 */
export function estimateRoomEnergy(
  currentMessage: string,
  messageTimestamps: number[],
): ClientRoomEnergyHint {
  const userEnergy = detectClientEnergy(currentMessage).energy;

  // Engagement: based on how recently and frequently user is messaging
  const now = Date.now();
  const recentMessages = messageTimestamps.filter(t => now - t < 5 * 60 * 1000); // last 5 min
  const timeSinceLastMessage = messageTimestamps.length > 0
    ? now - messageTimestamps[messageTimestamps.length - 1]
    : Infinity;

  let engagement: ClientRoomEnergyHint['engagement'] = 'contributing';
  if (recentMessages.length >= 5) engagement = 'active';
  else if (timeSinceLastMessage > 3 * 60 * 1000) engagement = 'idle';
  else if (recentMessages.length <= 1) engagement = 'listening';

  // Momentum: based on message frequency trend
  let momentum: ClientRoomEnergyHint['momentum'] = 'building';
  if (recentMessages.length === 0) {
    momentum = 'stalled';
  } else if (recentMessages.length >= 6) {
    // Check if frequency is increasing or decreasing
    const firstHalf = recentMessages.filter(t => t < now - 2.5 * 60 * 1000).length;
    const secondHalf = recentMessages.length - firstHalf;
    momentum = secondHalf > firstHalf ? 'building' : 'winding_down';
  } else if (recentMessages.length >= 3) {
    momentum = 'building';
  }

  return {
    userEnergy,
    engagement,
    momentum,
    timeSinceLastMessage: timeSinceLastMessage === Infinity ? -1 : timeSinceLastMessage,
  };
}
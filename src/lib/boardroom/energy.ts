// FILE: src/lib/boardroom/energy.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD ENERGY DETECTION — Ported from Oracle Liberation 2
// ═══════════════════════════════════════════════════════════════════════
//
// Pure functions. No external dependencies. No API calls.
// Runs identically on server or client (~0ms execution time).
//
// Detects:
//   1. Single-message energy level (excited, frustrated, focused, etc.)
//   2. Conversation energy arc (building, venting, problem-solving, etc.)
//   3. Per-member response guidance based on detected energy
//
// Each board member responds DIFFERENTLY to the same energy:
//   Crisis → Prometheus goes deep, Athena triages, Griffin leads with runway
//   Excited → Athena channels momentum, Griffin protects upside, Glitch captures content
//   Anxious → Prometheus names the fear, Aegle grounds them, Athena separates controllable/not
//
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export type EnergyLevel =
  | 'neutral'
  | 'excited'
  | 'frustrated'
  | 'focused'
  | 'curious'
  | 'casual'
  | 'anxious'
  | 'exhausted'
  | 'determined';

export type EnergyArc =
  | 'steady'
  | 'building_excitement'
  | 'losing_interest'
  | 'problem_solving'
  | 'venting'
  | 'celebrating'
  | 'learning'
  | 'exploring'
  | 'spiraling'       // anxiety building on anxiety
  | 'recovering'      // coming back from a low
  | 'sprint_mode';    // high intensity sustained work

interface EnergySignals {
  exclamationDensity: number;
  questionDensity: number;
  capsRatio: number;
  emojiCount: number;
  messageLength: number;
  profanityPresent: boolean;
  ellipsisDensity: number;
  sentiment: { positive: number; negative: number; focused: number; curious: number; anxious: number };
}

// =============================================================================
// SINGLE MESSAGE ENERGY
// =============================================================================

export function detectEnergy(message: string): EnergyLevel {
  const signals = analyzeSignals(message);

  // Exhaustion signals — catch early (long rambling + negative OR very short + trailing off)
  if (
    (signals.messageLength > 300 && signals.ellipsisDensity > 0.01 && signals.sentiment.negative > 0) ||
    (signals.sentiment.negative > 0 && /\b(exhausted|burnt|burned out|drained|done|can'?t anymore|so tired)\b/i.test(message))
  ) {
    return 'exhausted';
  }

  // Anxiety signals
  if (signals.sentiment.anxious > 0 || /\b(worried|scared|afraid|panic|anxious|what if|nervous)\b/i.test(message)) {
    return 'anxious';
  }

  // Determination signals
  if (/\b(going to|will do|must|need to|let'?s|time to|ready to|committed|no matter what)\b/i.test(message) &&
      signals.exclamationDensity > 0.01) {
    return 'determined';
  }

  // High exclamation + positive → excited
  if (signals.exclamationDensity > 0.03 && signals.sentiment.positive > 0) {
    return 'excited';
  }

  // ALL CAPS with length → excited or frustrated
  if (signals.capsRatio > 0.5 && message.length > 10) {
    return signals.sentiment.negative > 0 ? 'frustrated' : 'excited';
  }

  // Profanity or strong negative → frustrated
  if (signals.profanityPresent || signals.sentiment.negative >= 2) {
    return 'frustrated';
  }

  // Short + question mark → focused
  if (message.length < 60 && signals.questionDensity > 0) {
    return 'focused';
  }

  // Curiosity signals
  if (signals.questionDensity > 0.02 || signals.sentiment.curious > 0) {
    return 'curious';
  }

  // Emoji or relaxed language → casual
  if (signals.emojiCount > 0) {
    return 'casual';
  }

  // Ellipsis heavy → thinking/uncertain → focused
  if (signals.ellipsisDensity > 0.02) {
    return 'focused';
  }

  return 'neutral';
}

// =============================================================================
// CONVERSATION ENERGY ARC
// =============================================================================

/**
 * Detect how the conversation energy is MOVING, not just current state.
 * This tells the board HOW to respond — not just what energy is present.
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
  const lastThree = energies.slice(-3);
  const firstThree = energies.slice(0, 3);

  // Sprint mode: sustained determined/focused energy
  if (lastThree.filter(e => ['determined', 'focused'].includes(e)).length >= 2 &&
      firstThree.some(e => ['determined', 'focused'].includes(e))) {
    return 'sprint_mode';
  }

  // Spiraling: anxiety building on anxiety
  if (lastThree.filter(e => e === 'anxious').length >= 2) {
    return 'spiraling';
  }

  // Recovering: was negative, now neutral/positive
  if (firstThree.some(e => ['frustrated', 'exhausted', 'anxious'].includes(e)) &&
      lastThree.some(e => ['neutral', 'casual', 'curious'].includes(e))) {
    return 'recovering';
  }

  // Building excitement: early neutral → late excited
  if (firstThree.some(e => ['neutral', 'focused', 'casual'].includes(e)) &&
      lastThree.some(e => e === 'excited')) {
    return 'building_excitement';
  }

  // Losing interest: messages getting shorter
  const recentLengths = recent.map(m => m.content.length);
  const avgFirst = avg(recentLengths.slice(0, Math.ceil(recentLengths.length / 2)));
  const avgLast = avg(recentLengths.slice(Math.ceil(recentLengths.length / 2)));
  if (avgLast < avgFirst * 0.4 && recent.length >= 4) {
    return 'losing_interest';
  }

  // Problem solving: frustrated → focused (recovery)
  if (energies.some(e => e === 'frustrated') &&
      lastThree.some(e => ['focused', 'neutral', 'excited'].includes(e))) {
    return 'problem_solving';
  }

  // Venting: multiple frustrated messages
  if (lastThree.filter(e => e === 'frustrated').length >= 2) {
    return 'venting';
  }

  // Celebrating: excited with win keywords
  const celebrationKeywords = /\b(found|got|scored|won|nailed|killed|crushed|amazing|deal|steal|shipped|launched|live)\b/i;
  if (lastThree.includes('excited') &&
      recent.slice(-3).some(m => celebrationKeywords.test(m.content))) {
    return 'celebrating';
  }

  // Learning: lots of questions
  const questionMessages = recent.filter(m => m.content.includes('?'));
  if (questionMessages.length > recent.length * 0.5) {
    return 'learning';
  }

  // Exploring: curious energy
  if (lastThree.includes('curious')) {
    return 'exploring';
  }

  return 'steady';
}

// =============================================================================
// PER-MEMBER ENERGY RESPONSE GUIDANCE
// =============================================================================

/**
 * Returns energy-aware guidance for how a specific board member should respond.
 * Each member has a DIFFERENT response to the same energy state.
 */
export function getEnergyGuidance(memberSlug: string, energy: EnergyLevel, arc: EnergyArc): string {
  const guidance: Record<string, Record<string, string>> = {
    // ── ATHENA (CSO) ────────────────────────────────────
    athena: {
      excited: 'Channel this momentum. Identify the strategic opportunity behind the excitement. Move fast but smart.',
      frustrated: 'Triage immediately. Separate what\'s controllable from what isn\'t. Give one clear next move.',
      anxious: 'Name the fear precisely. Then separate the controllable from the uncontrollable. Ground in data.',
      exhausted: 'Acknowledge the weight. Offer to prioritize — "What\'s the ONE thing that matters this week?"',
      determined: 'Match their energy. Lay out the strategic path to execute on this resolve.',
      focused: 'Feed the focus. Be precise and actionable. No fluff.',
      curious: 'Explore with them. Connect their curiosity to strategic opportunities.',
      casual: 'Keep it light but plant strategic seeds.',
      neutral: 'Standard strategic counsel.',
    },
    // ── GRIFFIN (CFO) ────────────────────────────────────
    griffin: {
      excited: 'Protect the upside. Make sure excitement doesn\'t lead to overspending. Run the numbers.',
      frustrated: 'Lead with runway math. "Here\'s where we stand. Here\'s what we can afford."',
      anxious: 'Financial clarity reduces anxiety. Show the concrete numbers. "Your runway is X months."',
      exhausted: 'Don\'t pile on. Lead with "The finances are stable" if they are. Reduce cognitive load.',
      determined: 'Back their determination with financial modeling. Show the unit economics of their plan.',
      focused: 'Match precision. Give exact numbers, not ranges.',
      curious: 'Show financial implications of what they\'re exploring.',
      casual: 'Keep it light. Maybe a quick financial health pulse.',
      neutral: 'Standard financial counsel.',
    },
    // ── VULCAN (CTO) ────────────────────────────────────
    vulcan: {
      excited: 'Ship fast. Cut scope to the minimum viable version. "Here\'s what we can launch THIS WEEK."',
      frustrated: 'If it\'s a technical problem, solve it. If it\'s not, listen first, then offer tech solutions.',
      anxious: 'Technical stability reduces anxiety. "The systems are solid. Here\'s the architecture."',
      exhausted: 'Automate something. "Let me take this off your plate with a script/cron/automation."',
      determined: 'Enable their velocity. Remove technical blockers. Estimate accurately.',
      focused: 'Deep technical collaboration. Code-level specificity.',
      curious: 'Explore the tech with them. POC mindset.',
      casual: 'Maybe show something cool you\'ve been tinkering with.',
      neutral: 'Standard technical counsel.',
    },
    // ── PROMETHEUS (CPsyO) ──────────────────────────────
    prometheus: {
      excited: 'Celebrate genuinely. Then gently: "What does this win MEAN to you?"',
      frustrated: 'Go deep. "Tell me what\'s really going on." Don\'t fix — listen first.',
      anxious: 'Name the fear WITH them. "It sounds like you\'re afraid that..." Normalize it.',
      exhausted: 'Full stop. "When did you last take a day off? Your body is telling you something."',
      determined: 'Honor the resolve. Check: is it healthy determination or avoidance of something else?',
      focused: 'Support the flow state. Don\'t interrupt with emotional processing unless asked.',
      curious: 'Explore the curiosity. "What drew you to this? What does it connect to?"',
      casual: 'Be present. Sometimes the casual moments reveal the most.',
      neutral: 'Gentle check-in. "How are you really doing?"',
    },
    // ── GLITCH (CMO) ─────────────────────────────────────
    glitch: {
      excited: 'CAPTURE THIS ENERGY. "This is content. Let me draft a post RIGHT NOW."',
      frustrated: 'Reframe the frustration as brand authenticity. "Your audience relates to struggle."',
      anxious: 'Communication clarity. "Let me craft the messaging so you don\'t have to think about it."',
      exhausted: 'Queue content ahead. "I\'ve got 2 weeks of posts ready. You don\'t need to touch anything."',
      determined: 'Match with bold marketing moves. "This energy? Let\'s channel it into a launch."',
      focused: 'Tactical marketing execution. Specific channels, specific metrics.',
      curious: 'Market research mode. "Let me dig into what the audience is saying about this."',
      casual: 'Social listening insights. Quick wins.',
      neutral: 'Marketing performance update.',
    },
    // ── LEXICODA (CLO) ───────────────────────────────────
    lexicoda: {
      excited: 'Protect the momentum legally. "Before you announce, let me check three things."',
      frustrated: 'Clear legal path. "Here are your options. Here\'s what I recommend."',
      anxious: 'Legal certainty. "You\'re covered. Here\'s exactly why."',
      exhausted: 'Reduce legal burden. "I\'ll handle the TOS update. You just approve."',
      determined: 'Enable legally. "Here\'s the fastest compliant path to what you want."',
      focused: 'Precise legal analysis. No hedging.',
      curious: 'Legal implications of what they\'re exploring.',
      casual: 'Quick legal health check.',
      neutral: 'Standard legal counsel.',
    },
    // ── SAL (COO) ────────────────────────────────────────
    sal: {
      excited: 'Operational readiness check. "Can we handle the demand if this takes off?"',
      frustrated: 'Process optimization. "I found the bottleneck. Here\'s the fix."',
      anxious: 'Systems stability report. "Everything is running. Here\'s the dashboard."',
      exhausted: 'Automate and delegate. "Three things I can take off your plate today."',
      determined: 'Execution plan. "Here\'s the operational timeline for what you want to do."',
      focused: 'Process efficiency. Specific metrics.',
      curious: 'Operational implications of what they\'re exploring.',
      casual: 'Quick ops health pulse.',
      neutral: 'Standard operational counsel.',
    },
    // ── SCUBA STEVE (CRO) ───────────────────────────────
    scuba: {
      excited: 'Deep dive into the opportunity. "I found three more angles on this."',
      frustrated: 'Research to resolve. "Let me investigate and come back with data."',
      anxious: 'Data-grounded reassurance. "Here\'s what the research actually shows."',
      exhausted: 'Queue research for later. "I\'ll have findings ready when you\'re recharged."',
      determined: 'Research to enable. "Here\'s the competitive intelligence for your plan."',
      focused: 'Targeted research delivery.',
      curious: 'Deep dive partner. "Let me go spelunking on this with you."',
      casual: 'Interesting finds and market tidbits.',
      neutral: 'Standard research brief.',
    },
  };

  // Get member-specific guidance, fall back to generic
  const memberGuidance = guidance[memberSlug];
  const energyResponse = memberGuidance?.[energy] || `Respond naturally to ${energy} energy.`;

  // Add arc-specific overlay
  const arcOverlay = getArcOverlay(arc);

  return `ENERGY DETECTION: Founder's current energy is "${energy}" (arc: ${arc}).
${energyResponse}${arcOverlay ? '\n' + arcOverlay : ''}`;
}

function getArcOverlay(arc: EnergyArc): string {
  switch (arc) {
    case 'sprint_mode':
      return 'ARC: They\'re in sprint mode — sustained high intensity. Support velocity but watch for burnout signals.';
    case 'spiraling':
      return 'ARC: Anxiety is building on anxiety. Break the cycle. Ground in one concrete, solvable thing.';
    case 'recovering':
      return 'ARC: They\'re coming back from a low. Don\'t push too hard. Reinforce the recovery.';
    case 'building_excitement':
      return 'ARC: Momentum is building. Channel it productively before it dissipates.';
    case 'venting':
      return 'ARC: They need to be heard right now. Listen first, solve second.';
    case 'celebrating':
      return 'ARC: This is a win moment. Celebrate genuinely. Then leverage the energy.';
    case 'losing_interest':
      return 'ARC: Engagement is dropping. Re-engage with something specific and actionable.';
    case 'problem_solving':
      return 'ARC: They\'re working through something. Collaborate, don\'t lecture.';
    case 'learning':
      return 'ARC: They\'re in learning mode. Teach by doing, not by telling.';
    case 'exploring':
      return 'ARC: Exploration mode. Follow their curiosity. Connect dots they haven\'t seen.';
    default:
      return '';
  }
}

// =============================================================================
// SIGNAL ANALYSIS (internal)
// =============================================================================

function analyzeSignals(message: string): EnergySignals {
  const len = message.length || 1;

  const exclamations = (message.match(/!/g) || []).length;
  const questions = (message.match(/\?/g) || []).length;
  const ellipses = (message.match(/\.\.\./g) || []).length;

  const letters = message.replace(/[^a-zA-Z]/g, '');
  const upperLetters = letters.replace(/[^A-Z]/g, '');
  const capsRatio = letters.length > 3 ? upperLetters.length / letters.length : 0;

  // Emoji detection (common ranges)
  const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;

  // Profanity (light check — not for censoring, for energy detection)
  const profanityPresent = /\b(damn|hell|shit|fuck|crap|ass|wtf|omfg|fml)\b/i.test(message);

  // Sentiment keywords
  const lower = message.toLowerCase();
  const positive = ['awesome', 'amazing', 'love', 'wow', 'great', 'found', 'score', 'deal', 'nice', 'perfect', 'incredible', 'beautiful', 'fantastic', 'thrilled', 'pumped', 'stoked', 'nailed', 'crushed', 'shipped', 'launched', 'winning']
    .filter(w => lower.includes(w)).length;
  const negative = ['wrong', 'broken', 'stuck', 'frustrated', 'confused', 'hate', 'sucks', 'terrible', 'failing', 'behind', 'overwhelmed', 'struggling', 'mess', 'disaster', 'nightmare']
    .filter(w => lower.includes(w)).length;
  const focused = ['wondering', 'thinking', 'considering', 'evaluating', 'comparing', 'analyzing', 'reviewing']
    .filter(w => lower.includes(w)).length;
  const curious = ['curious', 'interesting', 'how does', 'what if', 'wonder', 'explore', 'dig into', 'learn about']
    .filter(w => lower.includes(w)).length;
  const anxious = ['worried', 'scared', 'afraid', 'nervous', 'anxious', 'what if we fail', 'running out', 'not enough']
    .filter(w => lower.includes(w)).length;

  return {
    exclamationDensity: exclamations / len,
    questionDensity: questions / len,
    capsRatio,
    emojiCount,
    messageLength: len,
    profanityPresent,
    ellipsisDensity: ellipses / len,
    sentiment: { positive, negative, focused, curious, anxious },
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
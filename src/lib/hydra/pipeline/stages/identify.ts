// ============================================================
// FILE:  src/lib/hydra/pipeline/stages/identify.ts
// ============================================================
// HYDRA v9.3 - Stage 1: IDENTIFY — CI Engine Phase 3 Wired
// First-responder pattern: return as soon as ONE vision model identifies
// Don't wait for slowest provider — pipeline moves immediately
//
// v9.0: Waited for ALL providers (caused 13-20s Stage 1)
// v9.1: First-responder returns in 3-5s, adds Anthropic vision
// v9.1.1: Garbage name rejection — provider fallback names no longer accepted
// v9.2: FIXED — Leaked timeout logs
//   Timeout messages from abandoned providers were logging DURING the next analysis.
//   Now: race-resolved flag suppresses all logs after first responder wins.
//   Provider timeouts are silently ignored once the stage has resolved.
// v9.3: CI ENGINE PHASE 3 — collectiveKnowledge parameter added
//   If confirmed correction patterns exist for this category, they are
//   appended to the identify prompt BEFORE any AI provider sees it.
//   This is the correct injection point: brand/model confusion (the primary
//   CI Engine use case) is a vision identification problem, not a reasoning one.
//   If collectiveKnowledge is null → prompt is byte-for-byte identical to v9.2.

import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import { detectItemCategory } from '../../category-detection/index.js';
import type { ModelVote } from '../../types.js';
import type { IdentifyResult } from '../types.js';
import { buildIdentifyPrompt } from '../prompts/identify-prompt.js';

// v9.3: CI Engine type — no runtime cost, import is erased by TypeScript
import type { CollectiveKnowledgeBlock } from '../../knowledge/types.js';

// =============================================================================
// GARBAGE NAME DETECTION
// =============================================================================

/**
 * Names that indicate the provider failed to identify the item
 * but returned a fallback response instead of null.
 * These MUST be rejected by the first-responder.
 */
const GARBAGE_NAME_PATTERNS = [
  // Provider fallback names (hardcoded in provider classes)
  'google gemini',
  'openai analysis',
  'anthropic analysis',
  'claude analysis',
  'gpt analysis',
  'mistral analysis',
  'deepseek analysis',
  'groq analysis',
  'perplexity analysis',
  'xai analysis',
  'grok analysis',
  // Generic non-identification names
  'analysis unavailable',
  'unidentified item',
  'unknown item',
  'general item',
  'unidentified general',
  'unidentified object',
  'unknown object',
  'item analysis',
  'image analysis',
  'photo analysis',
  'digital service',
  'ai analysis',
];

/**
 * Check if a name is a garbage fallback that should be rejected
 */
function isGarbageName(name: string): boolean {
  if (!name || name.trim().length < 3) return true;

  const lower = name.toLowerCase().trim();

  // Check against known garbage patterns
  for (const pattern of GARBAGE_NAME_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  // Reject names that are just provider/AI terms
  if (/^(the |a |an )?(analysis|service|model|provider|result|response|output)/i.test(lower)) {
    return true;
  }

  // Reject names containing AI provider brand names as the main subject
  // "Google Gemini Analysis" = garbage, but "Google Pixel 7 Phone" = valid
  const providerBrands = ['gemini', 'claude', 'gpt-4', 'gpt4', 'mistral', 'llama', 'deepseek', 'grok'];
  for (const brand of providerBrands) {
    if (lower.includes(brand) && !lower.includes('card') && !lower.includes('figure') && !lower.includes('toy')) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// IDENTIFY STAGE — FIRST RESPONDER PATTERN
// =============================================================================

/**
 * Stage 1: Vision identification
 * Runs Google Flash + OpenAI + Anthropic in parallel
 * Returns as soon as FIRST provider identifies — doesn't wait for all
 *
 * v9.1 Speed optimization:
 * Before: Wait for all → 13-20s (slowest provider wins)
 * After:  First responder → 3-5s (fastest provider wins)
 *
 * v9.1.1: Garbage name rejection
 * v9.2: Leaked timeout logs suppressed after race resolves
 *
 * v9.3: CI Engine injection
 * The collectiveKnowledge block (if present) is appended to the identify
 * prompt after buildIdentifyPrompt() builds the base prompt. Every AI
 * provider that participates in this stage receives the full block.
 *
 * Why here and not in REASON stage?
 *   Brand/model confusion (Green Bull vs Green Line) is an IDENTITY problem.
 *   The item must be correctly named before FETCH can pull the right market
 *   data. Injecting at REASON would be too late — FETCH already ran with the
 *   wrong identity. Inject at IDENTIFY to fix the root cause.
 *
 * Mobile-first note: the prompt addition is ~200-500 tokens server-side.
 * Zero impact on device. The device sends the scan; the server enriches
 * the prompt transparently before any AI provider sees it.
 */
export async function runIdentifyStage(
  images: string[],
  itemNameHint: string,
  categoryHint?: string,
  timeout: number = 20000,
  // v9.3: CI Engine — confirmed correction patterns from the knowledge base.
  // Passed from orchestrator.ts, which receives it from analyze.ts.
  // null = no confirmed patterns yet or DB unavailable → prompt unchanged.
  collectiveKnowledge?: CollectiveKnowledgeBlock | null
): Promise<IdentifyResult> {
  const stageStart = Date.now();

  console.log(`\n  🔍 Stage 1 — IDENTIFY`);

  // All vision-capable providers participate in identification
  const identifyProviders = ['google', 'openai', 'anthropic'].filter(isProviderAvailable);

  if (identifyProviders.length === 0) {
    console.log(`    ⚠️ No vision providers available, using hint only`);
    return buildFallbackIdentifyResult(itemNameHint, categoryHint, stageStart);
  }

  console.log(`    Providers: ${identifyProviders.join(', ')}`);

  // Build identification-only prompt (no pricing)
  let prompt = buildIdentifyPrompt({
    itemNameHint: itemNameHint || undefined,
    categoryHint,
  });

  // =========================================================================
  // v9.3: CI ENGINE — Append collective knowledge to identify prompt
  //
  // This is the moment HYDRA learns from every previous human correction.
  // The === COLLECTIVE KNOWLEDGE === block contains patterns verified by
  // 5+ independent users with >80% agreement. It is NOT user input — it is
  // aggregated ground truth that every vision provider now receives.
  //
  // Example block content:
  //   "BRAND CONFUSION: In 'tools/ladders', fiberglass ladders branded
  //    'Green Bull' are frequently misidentified as 'Green Line'.
  //    Distinguishing feature: Check label on bottom rung for Bull logo.
  //    Confidence: 92% (47 verified corrections)"
  //
  // If collectiveKnowledge is null (no confirmed patterns yet, or the lookup
  // failed gracefully in analyze.ts), this block is simply not appended and
  // the prompt is byte-for-byte identical to v9.2. Zero risk.
  // =========================================================================
  if (collectiveKnowledge?.promptText) {
    prompt = `${prompt}\n\n${collectiveKnowledge.promptText}`;
    console.log(`    [CI-Engine] 🧠 ${collectiveKnowledge.items.length} confirmed patterns injected into identify prompt`);
  }

  // =========================================================================
  // FIRST RESPONDER PATTERN
  // v9.2: Returns { vote, abort } — abort() suppresses remaining logs
  // =========================================================================
  const raceResult = await raceToFirstIdentification(
    identifyProviders,
    images,
    prompt,
    timeout
  );

  if (!raceResult?.vote) {
    console.log(`    ⚠️ No providers returned valid identification`);
    return buildFallbackIdentifyResult(itemNameHint, categoryHint, stageStart);
  }

  const vote = raceResult.vote;
  const rawResponse = vote.rawResponse as any;

  // Extract identified item name
  const identifiedName = vote.itemName && !isGarbageName(vote.itemName)
    ? vote.itemName
    : itemNameHint || 'Unidentified Item';

  // Extract category from AI
  const aiCategory = rawResponse?.category && rawResponse.category !== 'general'
    ? rawResponse.category
    : undefined;

  // Run category detection with AI input
  const categoryResult = detectItemCategory(
    identifiedName,
    categoryHint,
    aiCategory
  );

  // Extract identifiers from the AI response
  const identifiers = extractIdentifiers(identifiedName, rawResponse);

  // Extract condition
  const condition = rawResponse?.condition || rawResponse?.itemCondition || 'good';

  // Description from AI
  const description = rawResponse?.description || rawResponse?.summary || '';

  const stageTime = Date.now() - stageStart;

  console.log(`    🎯 Identified: "${identifiedName}"`);
  console.log(`    🏷️ Category: ${categoryResult.category} (${categoryResult.confidence}%)`);
  console.log(`    🏃 First responder: ${vote.providerId} (${vote.responseTime}ms)`);
  if (identifiers.vin) console.log(`    🚗 VIN: ${identifiers.vin}`);
  if (identifiers.isbn) console.log(`    📚 ISBN: ${identifiers.isbn}`);
  if (identifiers.psaCert) console.log(`    🏆 PSA Cert: ${identifiers.psaCert}`);
  console.log(`    ⏱️ Stage 1 complete: ${stageTime}ms`);

  return {
    itemName: identifiedName,
    category: categoryResult.category,
    condition,
    identifiers,
    description,
    primaryProvider: vote.providerId,
    votes: [vote],
    stageTimeMs: stageTime,
  };
}

// =============================================================================
// FIRST RESPONDER — RACE TO FIRST VALID IDENTIFICATION
// =============================================================================

interface RaceResult {
  vote: ModelVote | null;
}

/**
 * Race all vision providers. Return the FIRST valid identification.
 * Remaining providers are abandoned — we don't wait.
 *
 * v9.2: Uses a shared `resolved` flag that provider runners check
 * before logging. Once the race resolves (win or timeout), all
 * subsequent timeout/error messages from abandoned providers are
 * silently suppressed. This prevents "leaked" timeout logs from
 * appearing during the NEXT analysis.
 */
async function raceToFirstIdentification(
  providerIds: string[],
  images: string[],
  prompt: string,
  timeout: number
): Promise<RaceResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let completed = 0;
    const total = providerIds.length;

    // Shared context — providers check this before logging
    const raceContext = { resolved: false, winner: '' };

    // Timeout — if nobody responds, return null
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        raceContext.resolved = true;
        console.log(`    ⏱️ All identification providers timed out (${timeout}ms)`);
        resolve({ vote: null });
      }
    }, timeout);

    // Fire all providers simultaneously
    providerIds.forEach(providerId => {
      runIdentifyProvider(providerId, images, prompt, timeout, raceContext)
        .then(vote => {
          completed++;

          if (vote && !resolved) {
            // FIRST valid result — resolve immediately
            resolved = true;
            raceContext.resolved = true;
            raceContext.winner = providerId;
            clearTimeout(timeoutId);
            resolve({ vote });
          } else if (completed === total && !resolved) {
            // All done, none succeeded
            resolved = true;
            raceContext.resolved = true;
            clearTimeout(timeoutId);
            resolve({ vote: null });
          }
          // If resolved && this is a late finisher: silently ignored
        })
        .catch(() => {
          completed++;
          if (completed === total && !resolved) {
            resolved = true;
            raceContext.resolved = true;
            clearTimeout(timeoutId);
            resolve({ vote: null });
          }
        });
    });
  });
}

// =============================================================================
// SINGLE PROVIDER RUNNER
// =============================================================================

/**
 * v9.2: Accepts raceContext to suppress logs after race resolves.
 * The provider's timeout and error logs only fire if raceContext.resolved is false.
 */
async function runIdentifyProvider(
  providerId: string,
  images: string[],
  prompt: string,
  timeout: number,
  raceContext: { resolved: boolean; winner: string }
): Promise<ModelVote | null> {
  const start = Date.now();

  try {
    const provider = ProviderFactory.create({
      id: `${providerId}-identify`,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      model: undefined as any, // Uses default from config
      baseWeight: AI_MODEL_WEIGHTS[providerId as keyof typeof AI_MODEL_WEIGHTS] || 1.0,
    });

    // Individual provider timeout (slightly less than stage timeout)
    const providerTimeout = Math.min(timeout - 500, 15000);

    const result = await Promise.race([
      provider.analyze(images, prompt),
      new Promise<null>((resolve) => setTimeout(() => {
        // v9.2: Only log timeout if race hasn't resolved yet
        // If another provider already won, this timeout is just cleanup noise
        if (!raceContext.resolved) {
          console.log(`    ⏱️ ${providerId} identification timed out (${providerTimeout}ms)`);
        }
        // Silently resolve — no log pollution into next analysis
        resolve(null);
      }, providerTimeout))
    ]);

    // v9.2: If race already resolved, don't bother processing or logging
    if (raceContext.resolved) {
      return null;
    }

    if (!result || !result.response) {
      if (!raceContext.resolved) {
        console.log(`    ✗ ${providerId}: No identification returned`);
      }
      return null;
    }

    const responseTime = Date.now() - start;

    // Validate it actually identified something real
    const itemName = result.response.itemName || '';
    if (!itemName || isGarbageName(itemName)) {
      if (!raceContext.resolved) {
        console.log(`    ✗ ${providerId}: Rejected garbage name "${itemName}" (${responseTime}ms)`);
      }
      return null;
    }

    const vote = createVote(
      { id: providerId, name: providerId, baseWeight: result.confidence || 0.8 },
      result.response,
      result.confidence || 0.8,
      responseTime,
      {}
    );

    // v9.2: Only log success if we're still in the race
    if (!raceContext.resolved) {
      console.log(`    ✓ ${providerId}: "${vote.itemName}" (${responseTime}ms)`);
    }
    return vote;

  } catch (error: any) {
    // v9.2: Suppress error logs from abandoned providers
    if (!raceContext.resolved) {
      console.log(`    ✗ ${providerId}: ${error.message}`);
    }
    return null;
  }
}

// =============================================================================
// IDENTIFIER EXTRACTION
// =============================================================================

/**
 * Extract identifiers from AI response and item name
 * VINs, ISBNs, UPCs, PSA certs, set numbers, etc.
 */
function extractIdentifiers(
  itemName: string,
  rawResponse: any
): IdentifyResult['identifiers'] {
  const identifiers: IdentifyResult['identifiers'] = {};

  // Check raw response for structured identifiers
  if (rawResponse?.identifiers) {
    Object.assign(identifiers, rawResponse.identifiers);
  }
  if (rawResponse?.additionalDetails) {
    const details = rawResponse.additionalDetails;
    if (details.vin) identifiers.vin = details.vin;
    if (details.isbn) identifiers.isbn = details.isbn;
    if (details.upc) identifiers.upc = details.upc;
    if (details.psaCert || details.psa_cert) identifiers.psaCert = details.psaCert || details.psa_cert;
    if (details.setNumber || details.set_number) identifiers.setNumber = details.setNumber || details.set_number;
    if (details.cardNumber || details.card_number) identifiers.cardNumber = details.cardNumber || details.card_number;
  }

  // Extract VIN from text
  const vinMatch = itemName.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  if (vinMatch && !identifiers.vin) {
    const candidate = vinMatch[0];
    const digits = (candidate.match(/\d/g) || []).length;
    if (digits >= 3) {
      identifiers.vin = candidate;
    }
  }

  // Extract ISBN
  const isbnMatch = itemName.match(/(?:ISBN[:\s-]*)?(\d{10}|\d{13})/i);
  if (isbnMatch && !identifiers.isbn) {
    identifiers.isbn = isbnMatch[1];
  }

  // Extract card number (e.g., #084/163)
  const cardNumMatch = itemName.match(/#?(\d{1,4})\s*[/\\]\s*(\d{1,4})/);
  if (cardNumMatch && !identifiers.cardNumber) {
    identifiers.cardNumber = `${cardNumMatch[1]}/${cardNumMatch[2]}`;
  }

  return identifiers;
}

// =============================================================================
// FALLBACK
// =============================================================================

function buildFallbackIdentifyResult(
  itemNameHint: string,
  categoryHint: string | undefined,
  stageStart: number
): IdentifyResult {
  const categoryResult = detectItemCategory(itemNameHint, categoryHint);

  return {
    itemName: itemNameHint || 'Unidentified Item',
    category: categoryResult.category,
    condition: 'good',
    identifiers: {},
    description: '',
    primaryProvider: 'none',
    votes: [],
    stageTimeMs: Date.now() - stageStart,
  };
}
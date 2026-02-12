// FILE: src/lib/hydra/pipeline/stages/identify.ts
// HYDRA v9.1 - Stage 1: IDENTIFY
// First-responder pattern: return as soon as ONE vision model identifies
// Don't wait for slowest provider — pipeline moves immediately
//
// v9.0: Waited for ALL providers (caused 13-20s Stage 1)
// v9.1: First-responder returns in 3-5s, adds Anthropic vision
// v9.1.1: Garbage name rejection — provider fallback names no longer accepted

import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import { detectItemCategory } from '../../category-detection/index.js';
import type { ModelVote } from '../../types.js';
import type { IdentifyResult } from '../types.js';
import { buildIdentifyPrompt } from '../prompts/identify-prompt.js';

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
 * Provider fallback names like "Google Gemini Analysis" are now rejected.
 * Only real identifications are accepted.
 */
export async function runIdentifyStage(
  images: string[],
  itemNameHint: string,
  categoryHint?: string,
  timeout: number = 20000
): Promise<IdentifyResult> {
  const stageStart = Date.now();
  
  console.log(`\n  🔍 Stage 1 — IDENTIFY`);
  
  // All vision-capable providers participate in identification
  // Anthropic added in v9.1 — strong vision, often fastest
  const identifyProviders = ['google', 'openai', 'anthropic'].filter(isProviderAvailable);
  
  if (identifyProviders.length === 0) {
    console.log(`    ⚠️ No vision providers available, using hint only`);
    return buildFallbackIdentifyResult(itemNameHint, categoryHint, stageStart);
  }
  
  console.log(`    Providers: ${identifyProviders.join(', ')}`);
  
  // Build identification-only prompt (no pricing)
  const prompt = buildIdentifyPrompt({
    itemNameHint: itemNameHint || undefined,
    categoryHint,
  });
  
  // =========================================================================
  // FIRST RESPONDER PATTERN
  // Fire all providers simultaneously, return when FIRST one identifies.
  // Don't wait for slow providers — speed is critical for UX.
  // =========================================================================
  const vote = await raceToFirstIdentification(
    identifyProviders,
    images,
    prompt,
    timeout
  );
  
  if (!vote) {
    console.log(`    ⚠️ No providers returned valid identification`);
    return buildFallbackIdentifyResult(itemNameHint, categoryHint, stageStart);
  }
  
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

/**
 * Race all vision providers. Return the FIRST valid identification.
 * Remaining providers are abandoned — we don't wait.
 * 
 * This is the key speed optimization:
 * - Google Flash often returns in 2-3s
 * - Anthropic often returns in 3-5s  
 * - OpenAI can take 10-15s with images
 * 
 * Instead of waiting 15s for OpenAI, we return Google's result in 3s.
 * 
 * v9.1.1: Garbage names are rejected — provider must return real identification.
 */
async function raceToFirstIdentification(
  providerIds: string[],
  images: string[],
  prompt: string,
  timeout: number
): Promise<ModelVote | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let completed = 0;
    const total = providerIds.length;
    
    // Timeout — if nobody responds, return null
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`    ⏱️ All identification providers timed out (${timeout}ms)`);
        resolve(null);
      }
    }, timeout);
    
    // Fire all providers simultaneously
    providerIds.forEach(providerId => {
      runIdentifyProvider(providerId, images, prompt, timeout)
        .then(vote => {
          completed++;
          
          if (vote && !resolved) {
            // FIRST valid result — resolve immediately
            resolved = true;
            clearTimeout(timeoutId);
            resolve(vote);
          } else if (completed === total && !resolved) {
            // All done, none succeeded
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        })
        .catch(() => {
          completed++;
          if (completed === total && !resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        });
    });
  });
}

// =============================================================================
// SINGLE PROVIDER RUNNER
// =============================================================================

async function runIdentifyProvider(
  providerId: string,
  images: string[],
  prompt: string,
  timeout: number
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
        console.log(`    ⏱️ ${providerId} identification timed out (${providerTimeout}ms)`);
        resolve(null);
      }, providerTimeout))
    ]);
    
    if (!result || !result.response) {
      console.log(`    ✗ ${providerId}: No identification returned`);
      return null;
    }
    
    const responseTime = Date.now() - start;
    
    // Validate it actually identified something real
    const itemName = result.response.itemName || '';
    if (!itemName || isGarbageName(itemName)) {
      console.log(`    ✗ ${providerId}: Rejected garbage name "${itemName}" (${responseTime}ms)`);
      return null;
    }
    
    const vote = createVote(
      { id: providerId, name: providerId, baseWeight: result.confidence || 0.8 },
      result.response,
      result.confidence || 0.8,
      responseTime,
      {}
    );
    
    console.log(`    ✓ ${providerId}: "${vote.itemName}" (${responseTime}ms)`);
    return vote;
    
  } catch (error: any) {
    console.log(`    ✗ ${providerId}: ${error.message}`);
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
// FILE: src/lib/hydra/pipeline/stages/identify.ts
// HYDRA v9.0 - Stage 1: IDENTIFY
// Fast vision identification — Google Flash + OpenAI
// Task: What is this item? Do NOT price it.

import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import { detectItemCategory } from '../../category-detection/index.js';
import type { ModelVote } from '../../types.js';
import type { IdentifyResult } from '../types.js';
import { buildIdentifyPrompt } from '../prompts/identify-prompt.js';

// =============================================================================
// IDENTIFY STAGE
// =============================================================================

/**
 * Stage 1: Vision identification
 * Runs Google Flash + OpenAI in parallel
 * Returns item name, category, condition, identifiers
 * DOES NOT ask for pricing — that's Stage 3's job
 * 
 * Starts Stage 2 as soon as FIRST provider resolves (speed optimization)
 */
export async function runIdentifyStage(
  images: string[],
  itemNameHint: string,
  categoryHint?: string,
  timeout: number = 8000
): Promise<IdentifyResult> {
  const stageStart = Date.now();
  
  console.log(`\n  🔍 Stage 1 — IDENTIFY`);
  
  // Only vision providers participate in identification
  const identifyProviders = ['google', 'openai'].filter(isProviderAvailable);
  
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
  
  // Run providers in parallel with timeout
  const results = await Promise.allSettled(
    identifyProviders.map(providerId => 
      runIdentifyProvider(providerId, images, prompt, timeout)
    )
  );
  
  // Collect successful votes
  const votes: ModelVote[] = results
    .filter((r): r is PromiseFulfilledResult<ModelVote | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is ModelVote => v !== null);
  
  console.log(`    ✅ ${votes.length}/${identifyProviders.length} providers responded`);
  
  if (votes.length === 0) {
    return buildFallbackIdentifyResult(itemNameHint, categoryHint, stageStart);
  }
  
  // Pick best identification (highest confidence/weight)
  const bestVote = votes.reduce((a, b) => a.weight > b.weight ? a : b);
  const rawResponse = bestVote.rawResponse as any;
  
  // Extract identified item name
  const identifiedName = bestVote.itemName && bestVote.itemName !== 'Unknown Item'
    ? bestVote.itemName
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
  if (identifiers.vin) console.log(`    🚗 VIN: ${identifiers.vin}`);
  if (identifiers.psaCert) console.log(`    🏆 PSA Cert: ${identifiers.psaCert}`);
  console.log(`    ⏱️ Stage 1 complete: ${stageTime}ms`);
  
  return {
    itemName: identifiedName,
    category: categoryResult.category,
    condition,
    identifiers,
    description,
    primaryProvider: bestVote.providerId,
    votes,
    stageTimeMs: stageTime,
  };
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
    
    // Race against timeout
    const result = await Promise.race([
      provider.analyze(images, prompt),
      new Promise<null>((resolve) => setTimeout(() => {
        console.log(`    ⏱️ ${providerId} identification timed out (${timeout}ms)`);
        resolve(null);
      }, timeout))
    ]);
    
    if (!result || !result.response) {
      console.log(`    ✗ ${providerId}: No identification returned`);
      return null;
    }
    
    const responseTime = Date.now() - start;
    
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
  
  // Extract VIN from text (imported from vin module when extracted)
  const vinMatch = itemName.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  if (vinMatch && !identifiers.vin) {
    // Basic VIN validation: must have 3+ digits, not all letters
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
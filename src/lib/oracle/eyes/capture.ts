// FILE: src/lib/oracle/eyes/capture.ts
// Oracle Eyes — Visual Memory Capture
//
// Sprint M: Oracle Eyes — "Where did I leave my keys?"
//
// Three-tier capture model (mobile-first):
//
//   TIER 1 — PASSIVE (zero extra cost)
//     Piggybacks on existing HYDRA scans. When a user scans an item,
//     we already pay for vision AI. We just tell it to ALSO describe
//     the environment, visible objects, and any text in frame.
//     The phone sends the image anyway — we extract more from it.
//
//   TIER 2 — ACTIVE ("Oracle, remember this")
//     User deliberately captures a non-scan image (room, shelf, receipt).
//     Phone preprocesses: compresses, stamps GPS + timestamp, runs
//     on-device captioning if available. Server does one vision call.
//
//   TIER 3 — CONTINUOUS (future: glasses/wearable)
//     Periodic snapshots batched on-device, deduped, sent in bulk.
//     Scaffolded here but NOT implemented until Sprint M+.
//
// Mobile-first principle: The phone is the FIRST filter.
// It decides what's worth sending. Server never processes raw video.

import type { SupabaseClient } from '@supabase/supabase-js';
import { routeMessage, callOracle } from '../providers/index.js';
import type { OracleMessage } from '../providers/index.js';
import type { OracleIdentity } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export type CaptureMode = 'scan' | 'capture' | 'sweep' | 'glasses';
export type CaptureSource = 'phone_camera' | 'tablet' | 'glasses' | 'scan_piggyback';

export interface VisualMemory {
  id: string;
  user_id: string;
  mode: CaptureMode;
  description: string;
  objects: VisualObject[];
  extracted_text: string | null;
  tags: string[];
  location_hint: string | null;
  location_lat: number | null;
  location_lng: number | null;
  observed_at: string;
  source: CaptureSource;
  analysis_id: string | null;
  image_url: string | null;
  forgotten_at: string | null;
}

export interface VisualObject {
  name: string;
  position_hint?: string;     // "left side of frame", "on the table"
  estimated_value?: number;
  category?: string;
  confidence?: number;         // 0-1 how sure we are this object is identified
}

export interface CaptureRequest {
  /** Base64 image (Tier 2 only — Tier 1 uses existing scan image) */
  imageBase64?: string;
  /** Device-side caption if available (CoreML/ML Kit) */
  deviceCaption?: string;
  /** GPS coordinates from device */
  location?: { lat: number; lng: number };
  /** User's text hint: "my office", "garage shelf" */
  locationHint?: string;
  /** Capture source */
  source?: CaptureSource;
  /** Existing analysis ID for Tier 1 piggyback */
  analysisId?: string;
  /** Tags provided by user or device */
  tags?: string[];
}

export interface CaptureResult {
  memoryId: string;
  description: string;
  objectCount: number;
  hasText: boolean;
  tags: string[];
  processingTime: number;
}

// =============================================================================
// TIER 1: SCAN PIGGYBACK — Extract environment from existing HYDRA scan
// =============================================================================

/**
 * Extract visual memory from an existing HYDRA scan result.
 * Zero extra API cost — we parse what the vision AI already returned.
 *
 * Called after HYDRA pipeline completes. Extracts:
 *   - Background objects (not the scanned item)
 *   - Environment description
 *   - Any visible text (receipts, labels, price tags)
 *   - Object positions for spatial recall
 *
 * @param supabase   - Admin client
 * @param userId     - Who scanned
 * @param analysisId - HYDRA analysis ID
 * @param scanData   - HYDRA pipeline result (already has vision data)
 * @param imageUrl   - Stored image URL (if available)
 */
export async function captureFromScan(
  supabase: SupabaseClient,
  userId: string,
  analysisId: string,
  scanData: {
    itemName: string;
    category: string;
    allVotes?: any[];
    stages?: any;
  },
  imageUrl?: string | null
): Promise<CaptureResult | null> {
  const startTime = Date.now();

  try {
    // Extract environment details from HYDRA vote data
    // The vision AI already described the item — we look for BACKGROUND info
    const envDetails = extractEnvironmentFromVotes(scanData.allVotes || []);

    // If there's nothing interesting in the background, skip storage
    if (!envDetails.description && envDetails.objects.length === 0 && !envDetails.extractedText) {
      return null;
    }

    // Build tags from scan context + environment
    const tags = buildAutoTags(scanData.itemName, scanData.category, envDetails);

    // Store the memory
    const { data, error } = await supabase
      .from('oracle_visual_memory')
      .insert({
        user_id: userId,
        mode: 'scan' as CaptureMode,
        description: envDetails.description || `Scan of ${scanData.itemName}`,
        objects: envDetails.objects,
        extracted_text: envDetails.extractedText || null,
        tags,
        location_hint: null, // Tier 1 doesn't have GPS yet
        source: 'scan_piggyback' as CaptureSource,
        analysis_id: analysisId,
        image_url: imageUrl || null,
        observed_at: new Date().toISOString(),
        // Auto-expire scan memories after 30 days (can be changed in settings)
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Table might not exist yet — graceful fail
      if (error.code === '42P01') return null;
      console.warn('Visual memory capture failed (non-fatal):', error.message);
      return null;
    }

    return {
      memoryId: data.id,
      description: envDetails.description || '',
      objectCount: envDetails.objects.length,
      hasText: !!envDetails.extractedText,
      tags,
      processingTime: Date.now() - startTime,
    };
  } catch (err: any) {
    console.warn('Visual memory capture error (non-fatal):', err.message);
    return null;
  }
}

// =============================================================================
// TIER 2: ACTIVE CAPTURE — "Oracle, remember this"
// =============================================================================

/**
 * Capture a deliberate visual memory from the user.
 * User pressed "Remember this" or asked Oracle to remember something.
 *
 * Mobile-first flow:
 *   1. Phone compresses image + stamps GPS/timestamp
 *   2. Phone runs on-device caption if available (sent as deviceCaption)
 *   3. Server runs ONE vision call to enrich the description
 *   4. Server stores structured memory with search-optimized tags
 *
 * @param supabase  - Admin client
 * @param userId    - Who's capturing
 * @param request   - Capture data from device
 * @param identity  - Oracle identity (optional, for personality in descriptions)
 */
export async function captureManual(
  supabase: SupabaseClient,
  userId: string,
  request: CaptureRequest,
  identity?: OracleIdentity | null
): Promise<CaptureResult> {
  const startTime = Date.now();

  // If device already provided a caption, use it as a head start
  const deviceHint = request.deviceCaption || '';
  const locationHint = request.locationHint || '';

  // Run vision AI to extract structured data from the image
  let visionResult: VisionExtractionResult;

  if (request.imageBase64) {
    visionResult = await extractFromImage(request.imageBase64, deviceHint, locationHint);
  } else {
    // No image — just store the device caption and hints
    visionResult = {
      description: deviceHint || 'Manual memory capture',
      objects: [],
      extractedText: null,
      suggestedTags: [],
    };
  }

  // Merge device tags with AI-suggested tags
  const allTags = [...new Set([
    ...(request.tags || []),
    ...visionResult.suggestedTags,
    ...(locationHint ? [locationHint.toLowerCase()] : []),
  ])];

  // Store the memory
  const { data, error } = await supabase
    .from('oracle_visual_memory')
    .insert({
      user_id: userId,
      mode: 'capture' as CaptureMode,
      description: visionResult.description,
      objects: visionResult.objects,
      extracted_text: visionResult.extractedText,
      tags: allTags,
      location_hint: locationHint || null,
      location_lat: request.location?.lat || null,
      location_lng: request.location?.lng || null,
      source: request.source || 'phone_camera',
      analysis_id: request.analysisId || null,
      image_url: null, // Tier 2: image stored separately if user opts in
      observed_at: new Date().toISOString(),
      // Manual captures last 90 days (user chose to remember this)
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Memory capture failed: ${error.message}`);
  }

  return {
    memoryId: data.id,
    description: visionResult.description,
    objectCount: visionResult.objects.length,
    hasText: !!visionResult.extractedText,
    tags: allTags,
    processingTime: Date.now() - startTime,
  };
}

// =============================================================================
// FORGET — User asks Oracle to forget a memory
// =============================================================================

/**
 * Soft-delete a visual memory. Sets forgotten_at instead of hard delete.
 * User can say "Oracle, forget what you saw in my bedroom" or tap forget.
 */
export async function forgetMemory(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('oracle_visual_memory')
    .update({ forgotten_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Forget all memories matching a search query.
 * "Oracle, forget everything you saw at the pawn shop"
 */
export async function forgetByQuery(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<number> {
  // Use full-text search to find matching memories
  const { data } = await supabase
    .from('oracle_visual_memory')
    .select('id')
    .eq('user_id', userId)
    .is('forgotten_at', null)
    .textSearch('search_vector', query, { type: 'websearch' });

  if (!data || data.length === 0) return 0;

  const ids = data.map(d => d.id);

  const { error } = await supabase
    .from('oracle_visual_memory')
    .update({ forgotten_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', userId);

  return error ? 0 : ids.length;
}

// =============================================================================
// VISION EXTRACTION — Server-side image analysis for Tier 2
// =============================================================================

interface VisionExtractionResult {
  description: string;
  objects: VisualObject[];
  extractedText: string | null;
  suggestedTags: string[];
}

/**
 * Run a single vision API call to extract structured data from an image.
 * Optimized for speed — uses the cheapest vision-capable provider.
 */
async function extractFromImage(
  imageBase64: string,
  deviceHint: string,
  locationHint: string
): Promise<VisionExtractionResult> {
  const routing = routeMessage('describe what you see in detail', null, {
    hasImage: true,
    speedMode: true,
  });

  const systemPrompt = `You are Oracle Eyes — a visual memory system.
Analyze this image and extract:

1. DESCRIPTION: One paragraph describing the overall scene/environment.
2. OBJECTS: List every identifiable object with position hints.
3. TEXT: Any readable text (signs, labels, receipts, documents, screens).
4. TAGS: 3-8 single-word searchable tags for this scene.

${deviceHint ? `Device caption hint: "${deviceHint}"` : ''}
${locationHint ? `User says this is at: "${locationHint}"` : ''}

Respond in this exact JSON format (no markdown, no backticks):
{
  "description": "...",
  "objects": [{"name": "...", "position_hint": "...", "category": "..."}],
  "extracted_text": "..." or null,
  "tags": ["tag1", "tag2"]
}`;

  const messages: OracleMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analyze this image for my visual memory.' },
  ];

  try {
    const result = await callOracle(
      { ...routing, maxTokens: 500, temperature: 0.2 },
      messages
    );

    // Parse JSON response
    const cleaned = result.text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      description: parsed.description || 'Scene captured',
      objects: (parsed.objects || []).map((o: any) => ({
        name: String(o.name || ''),
        position_hint: o.position_hint || undefined,
        category: o.category || undefined,
        confidence: 0.8, // Default confidence for vision extraction
      })),
      extractedText: parsed.extracted_text || null,
      suggestedTags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch (err: any) {
    console.warn('Vision extraction failed, using fallback:', err.message);
    return {
      description: deviceHint || 'Image captured',
      objects: [],
      extractedText: null,
      suggestedTags: locationHint ? [locationHint.toLowerCase()] : [],
    };
  }
}

// =============================================================================
// HELPERS — Extract environment data from existing HYDRA votes
// =============================================================================

interface EnvironmentDetails {
  description: string;
  objects: VisualObject[];
  extractedText: string | null;
}

/**
 * Parse HYDRA vote data for background/environment information.
 * HYDRA votes contain detailed reasoning — we mine it for scene context.
 */
function extractEnvironmentFromVotes(votes: any[]): EnvironmentDetails {
  const objects: VisualObject[] = [];
  let description = '';
  let extractedText: string | null = null;

  for (const vote of votes) {
    const reasoning = vote.reasoning || vote.analysis || '';
    if (!reasoning) continue;

    // Look for mentions of background objects
    const bgPatterns = [
      /(?:also visible|in the background|nearby|beside it|on the (?:table|shelf|counter|desk)|also see|also present|surrounding)[:\s]+([^.]+)/gi,
      /(?:placed on|sitting on|resting on|displayed on)\s+(?:a\s+)?([^,.]+)/gi,
    ];

    for (const pattern of bgPatterns) {
      let match;
      while ((match = pattern.exec(reasoning)) !== null) {
        const objDesc = match[1].trim();
        if (objDesc.length > 3 && objDesc.length < 100) {
          objects.push({
            name: objDesc,
            position_hint: 'background',
            confidence: 0.6,
          });
        }
      }
    }

    // Look for text mentions
    const textPatterns = [
      /(?:text reads?|label says?|inscription|engraved|printed)[:\s]+"?([^".\n]+)"?/gi,
      /(?:serial number|model number|sku|upc|barcode)[:\s]+([A-Z0-9-]+)/gi,
    ];

    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(reasoning)) !== null) {
        const text = match[1].trim();
        if (text.length > 2) {
          extractedText = extractedText ? `${extractedText}\n${text}` : text;
        }
      }
    }

    // Use first vote's general description as scene context
    if (!description && reasoning.length > 50) {
      // Extract first sentence that describes the scene, not the item
      const sentences = reasoning.split(/[.!]/);
      const sceneSentence = sentences.find((s: string) =>
        /(?:background|setting|environment|table|shelf|room|surface)/i.test(s)
      );
      if (sceneSentence) {
        description = sceneSentence.trim();
      }
    }
  }

  // Deduplicate objects by name
  const seen = new Set<string>();
  const uniqueObjects = objects.filter(o => {
    const key = o.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    description,
    objects: uniqueObjects.slice(0, 10), // Cap at 10 background objects
    extractedText,
  };
}

/**
 * Build auto-tags from scan context and environment details.
 */
function buildAutoTags(
  itemName: string,
  category: string,
  env: EnvironmentDetails
): string[] {
  const tags = new Set<string>();

  // Item-based tags
  const words = itemName.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length > 3 && !STOP_WORDS.has(word)) {
      tags.add(word);
    }
  }

  // Category tag
  if (category && category !== 'general') {
    tags.add(category.toLowerCase());
  }

  // Object-based tags
  for (const obj of env.objects) {
    const objWords = obj.name.toLowerCase().split(/\s+/);
    for (const word of objWords) {
      if (word.length > 3 && !STOP_WORDS.has(word)) {
        tags.add(word);
      }
    }
  }

  return [...tags].slice(0, 15); // Cap at 15 tags
}

const STOP_WORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'have', 'been',
  'were', 'they', 'their', 'what', 'when', 'where', 'which',
  'there', 'about', 'would', 'could', 'should', 'might',
  'also', 'very', 'just', 'some', 'more', 'other', 'into',
]);
// FILE: api/oracle/ingest.ts
// Oracle URL Ingestion — powered by Perplexity sonar (live web browsing)
//
// Why Perplexity instead of server-side fetch + HTML strip?
//   - sonar is an online model — it actually VISITS the URL
//   - Handles JS-rendered pages, redirects, paywalled previews
//   - Returns structured content + citations automatically
//   - No HTML parsing, no regex stripping, no charset issues
//   - Same API key already in Vercel, same endpoint already in codebase
//
// Flow:
//   1. Client sends { type: 'url', url: '...' }
//   2. Server validates URL (no private IPs, https only)
//   3. Perplexity sonar browses the URL and extracts content
//   4. Structured content returned to client → useIngest → oracle/chat
//
// Documents (PDF, DOCX, TXT): still extracted CLIENT-SIDE in extractor.ts
// Images/Video: still routed through see.ts
// This file: URLs ONLY

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export const config = { maxDuration: 20 };

// =============================================================================
// PERPLEXITY CONFIG — matches src/lib/hydra/ai/perplexity.ts
// =============================================================================

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

// sonar = Perplexity's online model — live web browsing
// sonar-pro = deeper research, higher cost — use for research queries
const BROWSE_MODEL = 'sonar';

// =============================================================================
// URL VALIDATION
// =============================================================================

function validateUrl(raw: string): { valid: true; url: URL } | { valid: false; error: string } {
  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    return { valid: false, error: 'Invalid URL. Make sure it starts with https://' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  const host = parsed.hostname.toLowerCase();

  // Block private / internal ranges
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return { valid: false, error: 'Private/internal URLs are not supported.' };
  }

  return { valid: true, url: parsed };
}

// =============================================================================
// PERPLEXITY URL BROWSE
// Uses sonar's live web access — visits the actual page
// =============================================================================

interface BrowseResult {
  title: string;
  domain: string;
  content: string;
  summary: string;
  citations: string[];
  model: string;
}

async function browseWithPerplexity(url: string, apiKey: string): Promise<BrowseResult> {
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  })();

  const systemPrompt = `You are Oracle, an AI assistant that visits web pages and extracts their content for analysis. When given a URL, you browse it live and return its content in a structured way.

Always:
- Visit the actual URL and read the real content
- Extract the main content, key points, and important data
- Preserve numbers, prices, dates, and specific facts exactly as found
- Note if the page is paywalled, requires login, or is inaccessible
- Be comprehensive — the user wants to discuss this content with their AI assistant`;

  const userPrompt = `Please visit this URL and extract its content: ${url}

Return a thorough extraction including:
1. PAGE TITLE: The actual title of the page
2. MAIN CONTENT: The primary content of the page (article body, product info, listing details, etc.)
3. KEY FACTS: Important numbers, prices, dates, names, or data points
4. SUMMARY: A 2-3 sentence summary of what this page is about

Be thorough — the user will ask questions about this content.`;

  const response = await fetch(PERPLEXITY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: BROWSE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(18_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[ingest] Perplexity error:', response.status, errText);

    if (response.status === 401) {
      throw new Error('Perplexity API key is invalid or expired.');
    }
    if (response.status === 429) {
      throw new Error('Too many requests. Try again in a moment.');
    }
    throw new Error(`Could not browse that URL (Perplexity ${response.status}).`);
  }

  const data = await response.json();

  const content: string     = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];
  const model: string       = data.model || BROWSE_MODEL;

  if (!content || content.length < 50) {
    throw new Error('That page returned no readable content. It may require a login or be empty.');
  }

  // Extract title from content if Perplexity embedded it
  const titleMatch = content.match(/^(?:PAGE TITLE|Title)[:\s]+(.+?)(?:\n|$)/im);
  const title = titleMatch ? titleMatch[1].trim() : domain;

  // Extract summary if Perplexity embedded it
  const summaryMatch = content.match(/(?:SUMMARY|Summary)[:\s]+([\s\S]+?)(?:\n\n|$)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : content.substring(0, 300);

  return {
    title,
    domain,
    content,
    summary,
    citations,
    model,
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);

    const { type, url } = req.body;

    // Only URLs — documents are extracted client-side
    if (type !== 'url') {
      return res.status(400).json({
        error: 'Only type="url" is supported. Documents are processed client-side.',
      });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid "url" string is required.' });
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Get API key — matches providers.ts envKeys order exactly
    const apiKey =
      process.env.PERPLEXITY_API_KEY ||
      process.env.PPLX_API_KEY;

    if (!apiKey) {
      console.error('[ingest] No Perplexity API key found (tried PERPLEXITY_API_KEY, PPLX_API_KEY)');
      return res.status(503).json({
        error: 'Web browsing is not configured. Contact support.',
      });
    }

    console.log(`[ingest] Browsing: ${validation.url.hostname} via Perplexity ${BROWSE_MODEL}`);

    const result = await browseWithPerplexity(url, apiKey);

    console.log(`[ingest] Done: ${result.content.length} chars, ${result.citations.length} citations`);

    return res.status(200).json({
      type:          'url',
      url,
      domain:        result.domain,
      title:         result.title,
      summary:       result.summary,
      content:       result.content,
      citations:     result.citations,
      contentLength: result.content.length,
      model:         result.model,
      browsedLive:   true,
    });

  } catch (error: any) {
    const msg = error.message || 'Ingest failed';

    if (msg.includes('Authentication')) {
      return res.status(401).json({ error: msg });
    }
    if (msg.includes('API key') || msg.includes('Too many')) {
      return res.status(503).json({ error: msg });
    }
    if (msg.includes('no readable content') || msg.includes('login')) {
      return res.status(422).json({ error: msg });
    }
    if (error.name === 'TimeoutError' || msg.includes('timeout')) {
      return res.status(408).json({ error: 'That page took too long to load. Try again.' });
    }

    console.error('[oracle/ingest] Unexpected error:', msg);
    return res.status(500).json({ error: 'Could not browse that URL. Try a different link.' });
  }
}
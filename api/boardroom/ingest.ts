// FILE: api/boardroom/ingest.ts
// Board-Aware URL Intelligence — Domain-Filtered Research
//
// Unlike Oracle's generic ingest, every board member brings their
// domain expertise to URL analysis. The same business listing looks
// completely different through the CFO's eyes vs Legal vs the CSO.
//
// Domain filters per member role:
//   CFO       → Cash flow, EBITDA, debt, margins, multiples, tax structure
//   Legal     → Liability, contracts, IP, compliance, entity structure
//   CSO       → Market position, moat, growth vectors, competition
//   CTO       → Tech stack, scalability, technical debt, automation potential
//   COO       → Operations, processes, staff, systems, efficiency
//   CHRO      → Team, culture, retention, key-person risk
//   CMO       → Brand, customer acquisition, market awareness
//   General   → Full extraction, no filter
//
// Powered by Perplexity sonar-pro (deep research model).
// sonar = fast browse. sonar-pro = thorough research with citations.
// Board uses sonar-pro — accuracy over speed for high-stakes decisions.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export const config = { maxDuration: 25 };

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const RESEARCH_MODEL = 'sonar-pro'; // Deep research — board deserves the best

// =============================================================================
// DOMAIN EXTRACTION LENSES
// Per-role instructions that focus Perplexity on what matters most
// =============================================================================

const DOMAIN_LENSES: Record<string, string> = {
  CFO: `You are a CFO analyzing this for financial intelligence. Extract:
- Revenue, EBITDA, net income, profit margins
- Cash flow characteristics (recurring vs one-time)
- Debt load, liabilities, working capital requirements
- Revenue multiples, valuation benchmarks for this type of business
- Owner compensation (add-backs that inflate true earnings)
- Capital expenditure requirements
- Tax structure implications
- Acquisition price range and financing options
Flag any financial red flags immediately.`,

  Legal: `You are a Chief Legal Officer analyzing this for legal intelligence. Extract:
- Entity structure and ownership
- Existing contracts, leases, liabilities
- Regulatory compliance requirements
- IP assets or exposure
- Litigation history or pending disputes
- Employment law considerations
- Environmental or zoning issues
- Due diligence red flags
Flag any legal risks that could affect acquisition or operation.`,

  CSO: `You are a Chief Strategy Officer analyzing this for strategic intelligence. Extract:
- Market position and competitive moat
- Growth vectors and expansion opportunities
- Customer concentration risk
- Industry trends affecting this business
- Strategic acquirer value vs financial buyer value
- Integration opportunities with existing portfolio
- Disruption risk in the next 5 years
- Why this business wins or loses against competition.`,

  CTO: `You are a CTO analyzing this for technology and operational intelligence. Extract:
- Technology stack and systems in use
- Technical debt indicators
- Automation opportunities (what's manual that shouldn't be)
- Scalability constraints
- Cybersecurity posture
- Software dependencies and licensing
- Tech team quality indicators
- Digital transformation potential.`,

  COO: `You are a COO analyzing this for operational intelligence. Extract:
- Core operational processes
- Staff count, roles, key-person dependencies
- Supplier relationships and concentration
- Customer service model
- Quality control systems
- Geographic footprint and logistics
- Operational efficiency indicators
- What breaks first when this business scales.`,

  CHRO: `You are a CHRO analyzing this for people and culture intelligence. Extract:
- Team size, structure, seniority mix
- Key person risk (who leaves and it falls apart)
- Culture indicators
- Compensation benchmarks for this industry
- Retention challenges
- Founder/owner role post-acquisition
- Union or labor considerations
- Talent acquisition difficulty for this type of business.`,

  CMO: `You are a CMO analyzing this for market and brand intelligence. Extract:
- Brand strength and recognition
- Customer acquisition channels
- Customer demographics and psychographics
- Marketing spend and efficiency
- Online presence and SEO position
- Customer retention and LTV indicators
- Pricing power
- Cross-sell and upsell opportunities.`,

  General: `You are a senior business analyst. Provide a comprehensive extraction:
- Business model and revenue streams
- Key financial metrics
- Market position
- Operational overview
- Risk factors
- Opportunity assessment
Be thorough — this will be reviewed by a full executive board.`,
};

// =============================================================================
// MEMBER ROLE → LENS MAPPING
// =============================================================================

function getLensForMember(memberSlug: string, memberTitle: string): string {
  const titleUpper = (memberTitle || '').toUpperCase();
  const slug = (memberSlug || '').toLowerCase();

  if (titleUpper.includes('FINANCIAL') || titleUpper.includes('CFO') || slug.includes('cfo')) {
    return DOMAIN_LENSES.CFO;
  }
  if (titleUpper.includes('LEGAL') || titleUpper.includes('COUNSEL') || slug.includes('legal')) {
    return DOMAIN_LENSES.Legal;
  }
  if (titleUpper.includes('STRATEGY') || titleUpper.includes('CSO') || slug.includes('strateg')) {
    return DOMAIN_LENSES.CSO;
  }
  if (titleUpper.includes('TECHNOLOGY') || titleUpper.includes('CTO') || slug.includes('tech')) {
    return DOMAIN_LENSES.CTO;
  }
  if (titleUpper.includes('OPERATIONS') || titleUpper.includes('COO') || slug.includes('ops')) {
    return DOMAIN_LENSES.COO;
  }
  if (titleUpper.includes('PEOPLE') || titleUpper.includes('HR') || titleUpper.includes('CHRO')) {
    return DOMAIN_LENSES.CHRO;
  }
  if (titleUpper.includes('MARKETING') || titleUpper.includes('CMO') || slug.includes('market')) {
    return DOMAIN_LENSES.CMO;
  }

  return DOMAIN_LENSES.General;
}

// =============================================================================
// URL VALIDATION
// =============================================================================

function validateUrl(raw: string): { valid: true; url: URL } | { valid: false; error: string } {
  try {
    const parsed = new URL(raw.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return { valid: false, error: 'Private URLs are not supported.' };
    }
    return { valid: true, url: parsed };
  } catch {
    return { valid: false, error: 'Invalid URL.' };
  }
}

// =============================================================================
// PERPLEXITY DOMAIN-AWARE BROWSE
// =============================================================================

async function browseWithDomainLens(
  url: string,
  lens: string,
  memberName: string,
  apiKey: string,
): Promise<{
  content: string;
  summary: string;
  citations: string[];
  domain: string;
  title: string;
}> {
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  })();

  const systemPrompt = `${lens}

When analyzing content from a URL, you extract exactly the information your role demands.
You are precise, factual, and flag concerns immediately.
You cite specific numbers and facts — never vague summaries.
Member ${memberName} is relying on your domain expertise to make a high-stakes decision.`;

  const userPrompt = `Analyze this URL through your domain expertise: ${url}

Structure your response clearly with headers.
Lead with the most important finding for your domain.
End with a 2-3 sentence BOTTOM LINE assessment.`;

  const response = await fetch(PERPLEXITY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: RESEARCH_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(22_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[boardroom/ingest] Perplexity error:', response.status, errText);
    if (response.status === 401) throw new Error('Perplexity API key invalid.');
    if (response.status === 429) throw new Error('Rate limit — try again in a moment.');
    throw new Error(`Research failed (${response.status}).`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];

  if (!content || content.length < 50) {
    throw new Error('No readable content found at that URL.');
  }

  // Extract title
  const titleMatch = content.match(/^#+\s*(.+?)(?:\n|$)/m);
  const title = titleMatch ? titleMatch[1].trim() : domain;

  // Extract bottom line
  const bottomLineMatch = content.match(/BOTTOM LINE[:\s]+([\s\S]+?)(?:\n\n|$)/i);
  const summary = bottomLineMatch
    ? bottomLineMatch[1].trim()
    : content.substring(0, 300);

  return { content, summary, citations, domain, title };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    await verifyUser(req);

    const {
      type,
      url,
      memberSlug,
      memberTitle,
      memberName,
    } = req.body;

    if (type !== 'url') {
      return res.status(400).json({
        error: 'Only type="url" supported. Documents are processed client-side.',
      });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid "url" string is required.' });
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const apiKey =
      process.env.PERPLEXITY_API_KEY ||
      process.env.PPLX_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Research engine not configured.' });
    }

    // Get domain lens for this board member
    const lens = getLensForMember(memberSlug || '', memberTitle || '');

    console.log(`[boardroom/ingest] ${memberName || memberSlug} browsing: ${validation.url.hostname}`);

    const result = await browseWithDomainLens(
      url,
      lens,
      memberName || memberSlug || 'Board Member',
      apiKey,
    );

    console.log(`[boardroom/ingest] Done: ${result.content.length} chars, ${result.citations.length} citations`);

    return res.status(200).json({
      type: 'url',
      url,
      domain:        result.domain,
      title:         result.title,
      summary:       result.summary,
      content:       result.content,
      citations:     result.citations,
      contentLength: result.content.length,
      model:         RESEARCH_MODEL,
      memberSlug,
      domainFiltered: true,
    });

  } catch (error: any) {
    const msg = error.message || 'Ingest failed';
    if (msg.includes('Authentication')) return res.status(401).json({ error: msg });
    if (msg.includes('API key') || msg.includes('Rate limit')) {
      return res.status(503).json({ error: msg });
    }
    if (error.name === 'TimeoutError') {
      return res.status(408).json({ error: 'Research timed out. Try again.' });
    }
    console.error('[boardroom/ingest] Error:', msg);
    return res.status(500).json({ error: 'Research failed. Try a different URL.' });
  }
}
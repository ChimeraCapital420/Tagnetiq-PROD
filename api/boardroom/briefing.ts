// FILE: api/boardroom/briefing.ts
// Daily briefing generation - board members report autonomously

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// =============================================================================
// API KEYS
// =============================================================================
const ENV_KEYS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
  google: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  groq: ['GROQ_API_KEY'],
  xai: ['XAI_API_KEY', 'XAI_SECRET', 'GROK_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_TOKEN'],
};

function getApiKey(provider: string): string | null {
  const keys = ENV_KEYS[provider.toLowerCase()];
  if (!keys) return null;
  for (const envKey of keys) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

// =============================================================================
// GET COMPANY CONTEXT
// =============================================================================
async function getCompanyContext(): Promise<string> {
  const { data } = await supaAdmin
    .from('boardroom_company_context')
    .select('title, content')
    .eq('is_active', true)
    .order('priority', { ascending: false });
  
  if (!data || data.length === 0) return '';
  
  let context = '\n\n# === TAGNETIQ COMPANY KNOWLEDGE ===\n';
  for (const item of data) {
    context += `${item.content}\n\n`;
  }
  return context;
}

// =============================================================================
// BRIEFING SECTION GENERATORS
// =============================================================================

interface BriefingSection {
  member_slug: string;
  member_name: string;
  title: string;
  content: string;
  priority: number;
}

// Call a specific AI provider
async function callProvider(provider: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`${provider} API key not configured`);

  let response: Response;
  let data: any;

  switch (provider.toLowerCase()) {
    case 'perplexity':
      response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'anthropic':
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || '';

    case 'openai':
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'groq':
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    default:
      throw new Error(`Provider ${provider} not supported for briefings`);
  }
}

// Generate market intelligence section (Scuba Steve - Perplexity)
async function generateMarketIntelligence(companyContext: string): Promise<BriefingSection> {
  const systemPrompt = `You are Scuba Steve, Director of Deep Research at TagnetIQ. You have real-time web search capabilities.

${companyContext}

Your role in the daily briefing is to surface actionable market intelligence that the CEO needs to know TODAY.`;

  const userPrompt = `Generate today's Market Intelligence briefing. Search for and include:

1. **Collectibles Market News** - Any significant news in sports cards, Pokemon, coins, vinyl, comics
2. **Competitor Activity** - News about PSA, BGS, WhatNot, eBay, Collectors.com, Goldin
3. **AI Industry News** - Relevant AI developments that could impact our business
4. **Market Trends** - Price movements, auction results, emerging categories

Format as a concise briefing with bullet points. Lead with the most important/actionable items.
Include sources where relevant. Keep it under 500 words - respect the CEO's time.`;

  const content = await callProvider('perplexity', 'sonar', systemPrompt, userPrompt);

  return {
    member_slug: 'scuba',
    member_name: 'Scuba Steve',
    title: '🔍 Market Intelligence',
    content,
    priority: 10,
  };
}

// Generate strategic update (Athena - Anthropic)
async function generateStrategicUpdate(companyContext: string): Promise<BriefingSection> {
  const systemPrompt = `You are Athena, Chief Strategy Officer of TagnetIQ.

${companyContext}

Your role in the daily briefing is to provide strategic perspective on market developments.`;

  const userPrompt = `Generate today's Strategic Update. Consider:

1. **Strategic Implications** - What do recent market/competitor moves mean for us?
2. **Opportunities** - Any emerging opportunities we should consider?
3. **Threats** - Any developments that could threaten our position?
4. **Recommended Focus** - What should the CEO prioritize today?

Keep it concise and actionable. Under 300 words.`;

  const content = await callProvider('anthropic', 'claude-sonnet-4-20250514', systemPrompt, userPrompt);

  return {
    member_slug: 'athena',
    member_name: 'Athena',
    title: '🎯 Strategic Update',
    content,
    priority: 9,
  };
}

// Generate tech/product update (Vulcan - Anthropic)
async function generateTechUpdate(companyContext: string): Promise<BriefingSection> {
  const systemPrompt = `You are Vulcan, CTO of TagnetIQ.

${companyContext}

Your role in the daily briefing is to highlight technical priorities and opportunities.`;

  const userPrompt = `Generate today's Tech & Product Update. Consider:

1. **Technical Priorities** - What should be built/fixed today?
2. **AI Developments** - Any relevant AI/ML news that impacts our stack?
3. **Infrastructure** - Any platform, performance, or security considerations?
4. **Quick Wins** - Any low-effort, high-impact technical improvements?

Keep it concise. Under 250 words.`;

  const content = await callProvider('anthropic', 'claude-sonnet-4-20250514', systemPrompt, userPrompt);

  return {
    member_slug: 'vulcan',
    member_name: 'Vulcan',
    title: '⚡ Tech Update',
    content,
    priority: 7,
  };
}

// Generate growth/marketing update (Glitch - xAI has web access via Grok)
async function generateGrowthUpdate(companyContext: string): Promise<BriefingSection> {
  const systemPrompt = `You are Glitch, CMO of TagnetIQ. You're creative, energetic, and always looking for growth opportunities.

${companyContext}

Your role in the daily briefing is to surface marketing opportunities and growth ideas.`;

  const userPrompt = `Generate today's Growth & Marketing Update. Include:

1. **Content Ideas** - What trending topics could we create content about?
2. **Social Opportunities** - Any viral moments or trends we could tap into?
3. **Growth Tactics** - One specific tactic to try today
4. **Quick Win** - One marketing action that takes <30 minutes

Be creative but practical. Under 250 words.`;

  const content = await callProvider('groq', 'llama-3.1-8b-instant', systemPrompt, userPrompt);

  return {
    member_slug: 'glitch',
    member_name: 'Glitch',
    title: '🚀 Growth Update',
    content,
    priority: 6,
  };
}

// Generate executive summary (Griffin - OpenAI)
async function generateExecutiveSummary(sections: BriefingSection[], companyContext: string): Promise<string> {
  const systemPrompt = `You are Griffin, CFO of TagnetIQ. You think clearly and communicate efficiently.

${companyContext}`;

  const sectionsText = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');

  const userPrompt = `Based on today's briefing from the team, write a 3-sentence executive summary for the CEO.
Focus on: What's most important? What requires immediate attention? What's the overall outlook?

Today's briefing:
${sectionsText}

Write the executive summary (3 sentences max):`;

  return callProvider('openai', 'gpt-4o', systemPrompt, userPrompt);
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supaAdmin
      .from('boardroom_access')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required' });
    }

    // GET - Get today's briefing or history
    if (req.method === 'GET') {
      const { date, history } = req.query;

      if (history === 'true') {
        const { data: briefings } = await supaAdmin
          .from('boardroom_briefings')
          .select('id, briefing_date, briefing_type, summary, read_at, created_at')
          .eq('user_id', user.id)
          .order('briefing_date', { ascending: false })
          .limit(30);

        return res.status(200).json(briefings || []);
      }

      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data: briefing } = await supaAdmin
        .from('boardroom_briefings')
        .select('*')
        .eq('user_id', user.id)
        .eq('briefing_date', targetDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!briefing) {
        return res.status(200).json({ 
          exists: false, 
          date: targetDate,
          message: 'No briefing for this date. POST to generate one.' 
        });
      }

      // Mark as read
      if (!briefing.read_at) {
        await supaAdmin
          .from('boardroom_briefings')
          .update({ read_at: new Date().toISOString() })
          .eq('id', briefing.id);
      }

      return res.status(200).json(briefing);
    }

    // POST - Generate new briefing
    if (req.method === 'POST') {
      const { type = 'morning' } = req.body;

      const companyContext = await getCompanyContext();

      // Generate sections in parallel
      const sectionPromises = [
        generateMarketIntelligence(companyContext),
        generateStrategicUpdate(companyContext),
        generateTechUpdate(companyContext),
        generateGrowthUpdate(companyContext),
      ];

      const sections = await Promise.all(sectionPromises.map(p => 
        p.catch(err => ({
          member_slug: 'error',
          member_name: 'Error',
          title: '⚠️ Section Failed',
          content: err.message,
          priority: 0,
        }))
      ));

      // Sort by priority
      sections.sort((a, b) => b.priority - a.priority);

      // Generate executive summary
      const validSections = sections.filter(s => s.member_slug !== 'error');
      const summary = validSections.length > 0 
        ? await generateExecutiveSummary(validSections, companyContext).catch(() => 'Summary generation failed.')
        : 'No sections available for summary.';

      // Extract action items from sections
      const actionItems = sections
        .filter(s => s.content.toLowerCase().includes('action') || s.content.toLowerCase().includes('priority') || s.content.toLowerCase().includes('today'))
        .map(s => ({
          from: s.member_slug,
          section: s.title,
        }));

      // Save briefing
      const { data: briefing, error: saveError } = await supaAdmin
        .from('boardroom_briefings')
        .insert({
          user_id: user.id,
          briefing_date: new Date().toISOString().split('T')[0],
          briefing_type: type,
          sections: sections,
          summary,
          action_items: actionItems,
        })
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save briefing:', saveError);
        return res.status(500).json({ error: 'Failed to save briefing' });
      }

      return res.status(200).json(briefing);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Briefing API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
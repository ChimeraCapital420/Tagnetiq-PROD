// FILE: api/boardroom/tasks.ts
// Assign work to board members and get deliverables back

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// =============================================================================
// API KEY LOOKUP (from HYDRA)
// =============================================================================
const ENV_KEYS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
  google: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  gemini: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
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
// AI PROVIDER CALLS (simplified for task execution)
// =============================================================================
async function callProvider(provider: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`${provider} API key not configured`);

  let response: Response;
  let data: any;

  switch (provider.toLowerCase()) {
    case 'openai':
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.7,
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
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || '';

    case 'groq':
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'xai':
      response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'perplexity':
      response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'deepseek':
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'mistral':
      response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || '';

    case 'google':
    case 'gemini':
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 4096 },
          }),
        }
      );
      data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// =============================================================================
// TASK EXECUTION PROMPTS
// =============================================================================
const TASK_PROMPTS: Record<string, string> = {
  // Marketing tasks
  social_media_posts: `Create engaging social media content for TagnetIQ. Output should include:
- 3 Twitter/X posts (under 280 characters each)
- 2 LinkedIn posts (professional tone)
- 2 Instagram captions
Each should drive engagement and align with our brand as the "Bloomberg Terminal for Collectibles".`,

  marketing_copy: `Write compelling marketing copy for TagnetIQ. This should be punchy, memorable, and highlight our unique multi-AI valuation technology. Include headlines, subheadlines, and body copy variations.`,

  campaign_design: `Design a complete marketing campaign for TagnetIQ. Include:
- Campaign name and theme
- Target audience
- Key messaging
- Channel strategy
- Timeline
- Success metrics
- Content calendar outline`,

  email_sequences: `Create an email marketing sequence for TagnetIQ. Include:
- Welcome sequence (3 emails)
- Activation sequence (3 emails for users who haven't valued an item)
- Upgrade sequence (3 emails for converting free to premium)
Each email should have subject line, preview text, body, and CTA.`,

  // Strategic tasks
  competitive_analysis: `Conduct a competitive analysis for TagnetIQ. Research and analyze:
- Direct competitors (PSA, BGS, Collectors.com, WhatNot)
- Indirect competitors (eBay, individual AI tools)
- Their strengths, weaknesses, pricing, features
- Our differentiation opportunities
- Strategic recommendations`,

  investor_narrative: `Craft the investor narrative for TagnetIQ's seed round. Include:
- The problem (1 paragraph)
- The solution (1 paragraph)  
- Why now (market timing)
- Why us (team/tech advantage)
- The vision (where this goes)
- The ask (funding + use of funds)`,

  // Legal tasks
  terms_of_service: `Draft Terms of Service for TagnetIQ. Include sections on:
- Service description
- User accounts and responsibilities
- Acceptable use policy
- Intellectual property
- Disclaimers and limitations
- Termination
- Governing law
Make it professional but readable.`,

  privacy_policy: `Draft a Privacy Policy for TagnetIQ that is GDPR and CCPA compliant. Include:
- Information we collect
- How we use information
- Information sharing
- Data retention
- User rights
- Security measures
- Contact information`,

  // Technical tasks
  api_design: `Design the TagnetIQ public API specification. Include:
- Authentication (API keys)
- Core endpoints (valuation, vault, search)
- Request/response formats
- Rate limiting
- Error handling
- Example use cases
Output in OpenAPI/Swagger-like format.`,

  architecture_docs: `Write technical architecture documentation for TagnetIQ. Cover:
- System overview
- Component diagram
- Data flow
- Technology choices and rationale
- Scalability considerations
- Security architecture`,

  // Research tasks
  market_research: `Research the current state of the collectibles market. Include:
- Market size and growth trends
- Key segments (cards, coins, vinyl, etc.)
- Consumer behavior trends
- Technology disruption opportunities
- Emerging categories
- Investment/financial trends
Provide specific data and sources where possible.`,

  competitor_intel: `Gather competitive intelligence on the collectibles technology space. Research:
- Recent funding rounds
- Product launches
- Partnership announcements
- Leadership changes
- Pricing changes
- User sentiment
Focus on actionable insights.`,

  // Financial tasks
  financial_projections: `Create financial projections for TagnetIQ. Include:
- Revenue model assumptions
- 3-year revenue projection
- Cost structure
- Path to profitability
- Key metrics (CAC, LTV, burn rate)
- Funding milestones`,

  pricing_analysis: `Analyze and recommend pricing strategy for TagnetIQ. Consider:
- Current market pricing (PSA, competitors)
- Value-based pricing
- Freemium vs premium tiers
- Transaction fee structures
- B2B API pricing
- Price sensitivity analysis`,
};

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

    // GET - List tasks or get specific task
    if (req.method === 'GET') {
      const { id, status, assigned_to } = req.query;

      if (id) {
        const { data: task } = await supaAdmin
          .from('boardroom_tasks')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();
        return res.status(200).json(task);
      }

      let query = supaAdmin
        .from('boardroom_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (assigned_to) query = query.eq('assigned_to', assigned_to);

      const { data: tasks } = await query.limit(50);
      return res.status(200).json(tasks || []);
    }

    // POST - Create and execute a task
    if (req.method === 'POST') {
      const { assigned_to, title, description, task_type, priority, execute_now } = req.body;

      if (!assigned_to || !title || !task_type) {
        return res.status(400).json({ error: 'assigned_to, title, and task_type required' });
      }

      // Get the board member
      const { data: member, error: memberError } = await supaAdmin
        .from('boardroom_members')
        .select('*')
        .eq('slug', assigned_to)
        .single();

      if (memberError || !member) {
        return res.status(400).json({ error: `Board member '${assigned_to}' not found` });
      }

      // Create the task
      const { data: task, error: taskError } = await supaAdmin
        .from('boardroom_tasks')
        .insert({
          user_id: user.id,
          assigned_to,
          title,
          description: description || title,
          task_type,
          priority: priority || 'normal',
          status: execute_now ? 'in_progress' : 'pending',
          started_at: execute_now ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (taskError) {
        return res.status(500).json({ error: taskError.message });
      }

      // If execute_now, run the task immediately
      if (execute_now) {
        try {
          const companyContext = await getCompanyContext();
          
          // Build the task prompt
          const taskPrompt = TASK_PROMPTS[task_type] || description || title;
          const fullPrompt = `
## YOUR TASK
${title}

## ADDITIONAL CONTEXT
${description || 'No additional context provided.'}

## DELIVERABLE REQUIREMENTS
${taskPrompt}

## OUTPUT FORMAT
Provide a complete, professional deliverable that can be used immediately. Format appropriately for the task type.
`;

          const systemPrompt = `${member.system_prompt}\n${companyContext}\n\nYou are now executing a specific task for the CEO. Focus entirely on producing the requested deliverable. Be thorough, professional, and actionable.`;

          // Execute the task
          const deliverable = await callProvider(
            member.ai_provider,
            member.ai_model,
            systemPrompt,
            fullPrompt
          );

          // Update task with deliverable
          const { data: completedTask } = await supaAdmin
            .from('boardroom_tasks')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              deliverable_type: 'markdown',
              deliverable_content: deliverable,
            })
            .eq('id', task.id)
            .select()
            .single();

          return res.status(200).json({
            task: completedTask,
            deliverable,
            member: {
              name: member.name,
              title: member.title,
              slug: member.slug,
            },
          });
        } catch (execError: any) {
          // Update task as blocked
          await supaAdmin
            .from('boardroom_tasks')
            .update({
              status: 'blocked',
              deliverable_content: `Error: ${execError.message}`,
            })
            .eq('id', task.id);

          return res.status(500).json({ error: execError.message, task });
        }
      }

      return res.status(201).json({ task });
    }

    // PATCH - Update task (approve, request revision, etc.)
    if (req.method === 'PATCH') {
      const { id, ceo_feedback, ceo_approved, status } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Task ID required' });
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (ceo_feedback !== undefined) updates.ceo_feedback = ceo_feedback;
      if (ceo_approved !== undefined) updates.ceo_approved = ceo_approved;
      if (status !== undefined) updates.status = status;

      const { data: task } = await supaAdmin
        .from('boardroom_tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      return res.status(200).json(task);
    }

    // DELETE - Cancel task
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Task ID required' });
      }

      await supaAdmin
        .from('boardroom_tasks')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', user.id);

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Tasks API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
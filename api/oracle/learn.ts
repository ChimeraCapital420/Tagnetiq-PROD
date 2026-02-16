// FILE: api/oracle/learn.ts
// Structured learning endpoint — Oracle shifts to teacher mode
// "Teach me about coin grading" → multi-step interactive lesson
//
// POST /api/oracle/learn
// { topic, mode?, currentStep?, previousAnswers?, userAnswer? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildLearningPrompt } from '../../src/lib/oracle/prompt/learning-context.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// AUTH
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      topic,
      mode = 'general',
      currentStep = 1,
      totalSteps = 5,
      previousAnswers = [],
      userAnswer,
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Get user expertise level from memory
    let expertiseLevel = 'learning';
    const { data: identity } = await supabaseAdmin
      .from('oracle_identity')
      .select('ai_dna')
      .eq('user_id', user.id)
      .single();

    // Simple check from scan count
    const { count: scanCount } = await supabaseAdmin
      .from('scan_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((scanCount || 0) > 100) expertiseLevel = 'advanced';
    else if ((scanCount || 0) > 30) expertiseLevel = 'intermediate';
    else if ((scanCount || 0) > 5) expertiseLevel = 'learning';

    // If user answered a challenge, add to previous answers
    const allAnswers = [...previousAnswers];
    if (userAnswer) allAnswers.push(userAnswer);

    // Detect learning mode from topic
    const detectedMode = detectLearningMode(topic, mode);

    // Build the learning prompt
    const prompt = buildLearningPrompt({
      topic,
      mode: detectedMode,
      currentStep,
      totalSteps,
      previousAnswers: allAnswers,
      expertiseLevel,
    });

    // Generate lesson step
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Oracle, a brilliant teacher who makes complex topics engaging and practical. Always respond with valid JSON matching the requested format.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Lesson generation failed' });
    }

    const result = await response.json();
    const lesson = JSON.parse(result.choices[0].message.content);

    // Track learning progress
    await supabaseAdmin
      .from('oracle_learning_progress')
      .upsert({
        user_id: user.id,
        topic,
        current_step: currentStep,
        total_steps: totalSteps,
        mode: detectedMode,
        previous_answers: allAnswers,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,topic' });

    return res.status(200).json({
      step: {
        stepNumber: lesson.stepNumber || currentStep,
        totalSteps: lesson.totalSteps || totalSteps,
        title: lesson.title || `Step ${currentStep}`,
        content: lesson.content,
        challenge: lesson.challenge,
        hint: lesson.hint,
        funFact: lesson.funFact,
        completed: currentStep >= totalSteps,
      },
      topic,
      mode: detectedMode,
      expertiseLevel,
    });

  } catch (err: any) {
    console.error('[Oracle/Learn] Error:', err);
    return res.status(500).json({ error: 'Learning session failed' });
  }
}

// =============================================================================
// MODE DETECTION
// =============================================================================

function detectLearningMode(topic: string, requestedMode: string): string {
  if (requestedMode !== 'general') return requestedMode;

  const lower = topic.toLowerCase();

  // Authentication keywords
  if (/\b(fake|real|authentic|spot|tell|legit|replica|counterfeit)\b/.test(lower)) {
    return 'authentication_101';
  }

  // Market keywords
  if (/\b(market|price|trend|buy|sell|worth|value|invest)\b/.test(lower)) {
    return 'market_lesson';
  }

  // Negotiation keywords
  if (/\b(negotiate|haggle|deal|offer|counter|lowball|bargain)\b/.test(lower)) {
    return 'negotiation_drill';
  }

  // Deep dive keywords (specific categories)
  if (/\b(grading|condition|rare|variant|edition|series|mint|set)\b/.test(lower)) {
    return 'category_deep_dive';
  }

  return 'general';
}

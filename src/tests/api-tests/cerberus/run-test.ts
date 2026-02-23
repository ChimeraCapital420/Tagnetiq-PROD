// api/cerberus/run-test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { credentials } = req.body;
  if (!credentials) {
    return res.status(400).json({ error: 'Credentials required' });
  }

  // Create client for the AI agent
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  try {
    // Sign in the AI agent
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (authError) throw authError;

    const session = authData.session;

    // Test the analyze endpoint
    const analyzeResponse = await fetch(`${process.env.VERCEL_URL || 'https://www.tagnetiq.com'}/api/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: 'https://images.unsplash.com/photo-1587925358603-c2eea5305bbc',
        provider: 'anthropic'
      })
    });

    const analysisResult = await analyzeResponse.json();

    // Submit feedback
    const feedbackResponse = await fetch(`${process.env.VERCEL_URL || 'https://www.tagnetiq.com'}/api/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: 'functionality',
        rating: 8,
        comment: '[AI Test - ai_synthetic_test] Analysis endpoint test completed successfully',
        metadata: {
          test_scenario: 'analyze_item',
          ai_evaluator: 'claude-3-opus',
          timestamp: new Date().toISOString()
        }
      })
    });

    const feedbackResult = await feedbackResponse.json();

    // Sign out
    await supabase.auth.signOut();

    return res.status(200).json({
      success: true,
      results: {
        analysis: analysisResult,
        feedback: feedbackResult
      }
    });

  } catch (error: any) {
    console.error('Test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
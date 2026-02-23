// api/cerberus/test-basic-flow.ts
import { createClient } from '@supabase/supabase-js';

export async function runBasicTest(agentCredentials: any) {
  console.log('🧪 Starting basic flow test...');
  
  // Create Supabase client for authentication
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Sign in the AI agent
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: agentCredentials.email,
      password: agentCredentials.password
    });

    if (authError) {
      throw new Error(`Auth failed: ${authError.message}`);
    }

    const session = authData.session;
    console.log('✅ Agent authenticated successfully!');

    // Test 1: Analyze an item
    console.log('\n📸 Testing item analysis...');
    
    const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:5173'}/api/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: 'https://images.unsplash.com/photo-1587925358603-c2eea5305bbc', // Luxury watch
        provider: 'anthropic'
      })
    });

    const analysisResult = await analyzeResponse.json();
    console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));

    // Generate AI feedback on the analysis
    const feedbackPrompt = `As an AI QA tester, evaluate this item analysis response:
${JSON.stringify(analysisResult, null, 2)}

Rate the response on these criteria:
1. Clarity (1-10): Is the description clear and understandable?
2. Accuracy (1-10): Does the data seem accurate and consistent?
3. Completeness (1-10): Are all important fields present?
4. User Value (1-10): Would a user find this helpful?

Provide a JSON response with:
- ratings: object with scores for each criterion
- issues: array of any problems found
- suggestions: array of improvements
- overall_score: average of all ratings (1-10)`;

    // Use the Oracle to evaluate
    const oracleResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:5173'}/api/oracle/ask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: feedbackPrompt
        }],
        provider: 'anthropic'
      })
    });

    const oracleResult = await oracleResponse.json();
    console.log('\n🤖 Oracle response:', oracleResult);

    // Parse the AI's evaluation
    let feedback;
    try {
      // Extract JSON from the response if it's wrapped in text
      const jsonMatch = oracleResult.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        feedback = { overall_score: 5, issues: ['Could not parse AI response'], suggestions: [] };
      }
    } catch (e) {
      feedback = { overall_score: 5, issues: ['Could not parse AI response'], suggestions: [] };
    }

    // Submit feedback to your system
    const feedbackSubmission = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:5173'}/api/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'ai_synthetic_test',
        category: 'functionality',
        rating: Math.round(feedback.overall_score || 5),
        comment: `AI Test - Analysis Endpoint. Issues: ${JSON.stringify(feedback.issues || [])}. Suggestions: ${JSON.stringify(feedback.suggestions || [])}`,
        metadata: {
          test_scenario: 'analyze_item',
          ai_evaluator: 'claude-3-opus',
          issues: feedback.issues || [],
          suggestions: feedback.suggestions || [],
          timestamp: new Date().toISOString()
        }
      })
    });

    const feedbackResult = await feedbackSubmission.json();
    console.log('\n📊 Feedback submitted:', feedbackResult);
    
    // Sign out
    await supabase.auth.signOut();
    
    return {
      success: true,
      results: {
        analysis: analysisResult,
        aiEvaluation: feedback,
        feedbackSubmission: feedbackResult
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
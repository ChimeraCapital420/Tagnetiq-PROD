// FILE: api/jarvis/triage.ts (COMPLETE CORRECTED VERSION)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '../../src/server/db/index.js';
import { sql } from 'drizzle-orm';

interface TriageContext {
  image: string;
  quickContext?: string;
  environmentType?: string;
  previousScans?: string[];
  networkAlerts?: any[];
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as TriageContext;
    const { image, quickContext, environmentType, networkAlerts } = body;

    // Get network intelligence for context
    const networkData = await getNetworkIntelligence();

    // Rapid triage using Claude Sonnet
    const triageResult = await performRapidTriage({
      image,
      quickContext,
      environmentType,
      networkData,
      networkAlerts
    });

    // Calculate go/no-go decision
    const decision = makeTriageDecision(triageResult);

    // If high-value, prepare for deep dive
    if (decision.action === 'deep-dive') {
      await prepareDeepDive(triageResult, session.user.id);
    }

    return NextResponse.json({
      decision,
      triageResult,
      voiceResponse: generateVoiceResponse(decision, triageResult)
    });
  } catch (error) {
    console.error('Triage error:', error);
    return NextResponse.json({ error: 'Triage failed' }, { status: 500 });
  }
}

async function performRapidTriage(context: any) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    temperature: 0.3,
    system: `You are Jarvis, an expert physical asset evaluator performing rapid triage. 
    Analyze quickly and decisively. Consider network demand, authenticity markers, and profit potential.
    Current market trends: ${JSON.stringify(context.networkData.trends)}
    Active bounties: ${JSON.stringify(context.networkData.bounties)}`,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: context.image
          }
        },
        {
          type: 'text',
          text: `Environment: ${context.environmentType || 'unknown'}
          Quick context: ${context.quickContext || 'none'}
          Network alerts: ${JSON.stringify(context.networkAlerts || [])}
          
          Perform rapid triage:
          1. Item identification (specific as possible)
          2. Authenticity indicators (red flags vs positive signs)
          3. Estimated value range
          4. Network demand level (based on provided data)
          5. Profit potential (acquisition cost vs market value)
          6. GO/NO-GO recommendation with confidence %`
        }
      ]
    }]
  });

  // Fixed: Properly handle Anthropic response
  const textContent = response.content[0];
  if (textContent.type === 'text') {
    return JSON.parse(textContent.text);
  }
  throw new Error('Unexpected response format from Anthropic');
}

function makeTriageDecision(triageResult: any) {
  const { authenticity, estimatedValue, networkDemand, profitPotential, recommendation } = triageResult;
  
  // Multi-factor decision making
  const score = 
    (authenticity.confidence * 0.3) +
    (networkDemand.level * 0.2) +
    (profitPotential.margin * 0.3) +
    (estimatedValue.confidence * 0.2);

  if (score > 80 && recommendation.confidence > 85) {
    return {
      action: 'deep-dive',
      confidence: score,
      reasoning: 'High-value opportunity detected',
      suggestedOffer: calculateOptimalOffer(estimatedValue, profitPotential)
    };
  } else if (score > 60) {
    return {
      action: 'monitor',
      confidence: score,
      reasoning: 'Moderate opportunity - gather more data',
      suggestedAction: 'Take additional photos of key details'
    };
  } else {
    return {
      action: 'pass',
      confidence: score,
      reasoning: recommendation.reasoning || 'Better opportunities available'
    };
  }
}

async function getNetworkIntelligence() {
  const [trends, bounties, recentSales] = await Promise.all([
    // Get trending categories and items
    db.execute(sql`
      SELECT category, AVG(estimated_value) as avg_value, COUNT(*) as volume
      FROM items
      WHERE created_at > NOW() - INTERVAL '7 days'
      AND analysis_result->>'confidence' > '80'
      GROUP BY category
      ORDER BY volume DESC
      LIMIT 10
    `),
    
    // Get active bounties
    db.execute(sql`
      SELECT target_item, reward_amount, user_count
      FROM bounties
      WHERE expires_at > NOW()
      ORDER BY reward_amount DESC
      LIMIT 20
    `),
    
    // Get recent high-value sales
    db.execute(sql`
      SELECT name, category, sold_price, sold_at
      FROM items
      WHERE sold_price IS NOT NULL
      AND sold_at > NOW() - INTERVAL '30 days'
      ORDER BY sold_price DESC
      LIMIT 50
    `)
  ]);

  return {
    trends: trends.rows,
    bounties: bounties.rows,
    recentSales: recentSales.rows
  };
}

function calculateOptimalOffer(estimatedValue: any, profitPotential: any) {
  const targetMargin = 0.5; // 50% profit margin target
  const maxOffer = estimatedValue.min * (1 - targetMargin);
  
  return {
    initial: Math.floor(maxOffer * 0.7), // Start at 70% of max
    maximum: Math.floor(maxOffer),
    strategy: profitPotential.margin > 100 ? 'aggressive' : 'conservative'
  };
}

function generateVoiceResponse(decision: any, triageResult: any) {
  const responses = {
    'deep-dive': `Excellent find. ${triageResult.identification}. 
                  Estimated value: $${triageResult.estimatedValue.min} to $${triageResult.estimatedValue.max}. 
                  ${triageResult.networkDemand.level > 7 ? 'High network demand detected.' : ''} 
                  Recommended offer: $${decision.suggestedOffer.initial}. 
                  Say 'deep dive' to proceed with full analysis.`,
    
    'monitor': `Interesting item. ${triageResult.identification}. 
                Potential value around $${triageResult.estimatedValue.min}. 
                ${decision.suggestedAction}. 
                Worth monitoring for the right price.`,
    
    'pass': `Pass on this one. ${decision.reasoning}. 
             Keep hunting for better opportunities.`
  };

  return responses[decision.action];
}

async function prepareDeepDive(triageResult: any, userId: string) {
  // Store triage result for quick access during deep dive
  // This could be in Redis or a temporary database table
  console.log('Preparing deep dive for:', triageResult.identification);
  // Implementation depends on your caching strategy
}
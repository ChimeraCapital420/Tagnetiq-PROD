// api/jarvis/sweep.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '../../src/server/db';
import { watchlists, users } from '../../src/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { image, location, environment } = await req.json();

    // Get user's interests and network watchlists
    const [userProfile, activeWatchlists] = await Promise.all([
      getUserInterests(session.user.id),
      getActiveWatchlists()
    ]);

    // Use Gemini Flash for lightweight sweep
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Rapid sweep for collectible opportunities.
    User interests: ${JSON.stringify(userProfile.interests)}
    Network watchlists: ${JSON.stringify(activeWatchlists)}
    Environment: ${environment || 'unknown'}
    
    Identify items matching user interests or network demand.
    Focus on high-value opportunities.
    
    Respond with top opportunity only (if any):
    {
      "match": true/false,
      "item": "description",
      "reason": "why this is valuable",
      "urgency": "low/medium/high/critical",
      "estimatedValue": { "min": 0, "max": 0 }
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      const parsed = JSON.parse(text);
      
      if (parsed.match) {
        // Check if this matches any network bounties
        const bountyMatch = await checkBountyMatch(parsed.item);
        
        return NextResponse.json({
          type: bountyMatch ? 'network-bounty' : 'personal-interest',
          priority: parsed.urgency,
          item: {
            description: parsed.item,
            estimatedValue: parsed.estimatedValue
          },
          networkContext: bountyMatch ? {
            bountyValue: bountyMatch.rewardAmount,
            interestedUsers: bountyMatch.interestedCount
          } : undefined,
          nudgeMessage: generateNudgeMessage(parsed, bountyMatch)
        });
      }
      
      return NextResponse.json({ match: false });
    } catch (parseError) {
      console.error('Error parsing sweep response:', parseError);
      return NextResponse.json({ match: false });
    }
  } catch (error) {
    console.error('Sweep error:', error);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}

async function getUserInterests(userId: string) {
  const result = await db.select({
    interests: users.interests,
    categories: users.preferredCategories
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

  return result[0] || { interests: [], categories: [] };
}

async function getActiveWatchlists() {
  const result = await db.execute(sql`
    SELECT DISTINCT criteria, COUNT(*) as watchers
    FROM watchlists
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY criteria
    ORDER BY watchers DESC
    LIMIT 20
  `);

  return result.rows;
}

async function checkBountyMatch(itemDescription: string) {
  const result = await db.execute(sql`
    SELECT b.*, COUNT(DISTINCT wb.user_id) as interested_count
    FROM bounties b
    LEFT JOIN watchlist_bounties wb ON b.id = wb.bounty_id
    WHERE b.expires_at > NOW()
    AND SIMILARITY(b.target_item, ${itemDescription}) > 0.7
    GROUP BY b.id
    ORDER BY b.reward_amount DESC
    LIMIT 1
  `);

  return result.rows[0];
}

function generateNudgeMessage(parsed: any, bountyMatch: any): string {
  if (bountyMatch) {
    return `Network Opportunity: ${parsed.item} detected. Active bounty worth $${bountyMatch.rewardAmount}. ${bountyMatch.interestedCount} users seeking this item.`;
  }
  
  const urgencyPhrases = {
    critical: 'Critical opportunity',
    high: 'High-value find',
    medium: 'Interesting item',
    low: 'Potential opportunity'
  };
  
  return `${urgencyPhrases[parsed.urgency]}: ${parsed.item}. ${parsed.reason}`;
}
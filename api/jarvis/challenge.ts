// api/arena/challenge.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '../../src/server/db';
import { challenges, items, challengeParticipants } from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { itemId, type, wagerAmount, timeLimit, rules } = await req.json();

    // Verify item ownership
    const item = await db.select().from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item.length || item[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Item not found or unauthorized' }, { status: 404 });
    }

    // Create challenge
    const challengeId = createId();
    const expiresAt = new Date(Date.now() + (timeLimit * 1000));

    const [challenge] = await db.insert(challenges).values({
      id: challengeId,
      itemId,
      createdBy: session.user.id,
      type: type || 'authenticity',
      status: 'active',
      wagerAmount: wagerAmount || 0,
      expiresAt,
      rules: rules || getDefaultRules(type),
      metadata: {
        itemDetails: {
          name: item[0].name,
          category: item[0].category,
          images: item[0].images
        }
      }
    }).returning();

    // Notify relevant experts
    const participantCount = await notifyExperts(challenge, item[0]);

    return NextResponse.json({
      challengeId: challenge.id,
      status: 'created',
      expiresAt: challenge.expiresAt,
      participantCount,
      timeLimit,
      viewUrl: `/arena/challenges/${challenge.id}`
    });
  } catch (error) {
    console.error('Challenge creation error:', error);
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}

function getDefaultRules(type: string): string {
  const rules = {
    authenticity: `Standard Authenticity Challenge Rules:
    1. Participants must provide evidence-based analysis
    2. AI tools and reference materials are allowed
    3. Final consensus determines the outcome
    4. Minimum 3 expert opinions required`,
    
    valuation: `Valuation Challenge Rules:
    1. Estimates must include supporting market data
    2. Recent sales comparables required
    3. Winner is closest to average of top 5 estimates
    4. Condition factors must be considered`,
    
    identification: `Identification Challenge Rules:
    1. Must identify: maker, model, year, variant
    2. Supporting documentation required
    3. First correct complete answer wins
    4. Partial answers receive partial credit`
  };

  return rules[type] || rules.authenticity;
}

async function notifyExperts(challenge: any, item: any) {
  // Get relevant experts based on category
  const experts = await db.execute(sql`
    SELECT u.id, u.email, u.notification_preferences
    FROM users u
    JOIN user_expertise ue ON u.id = ue.user_id
    WHERE ue.category = ${item.category}
    AND ue.level >= 3
    AND u.id != ${challenge.createdBy}
    LIMIT 50
  `);

  // Create notifications for each expert
  const notifications = experts.rows.map(expert => ({
    userId: expert.id,
    type: 'arena_challenge',
    title: `New ${challenge.type} challenge: ${item.name}`,
    data: {
      challengeId: challenge.id,
      itemName: item.name,
      wagerAmount: challenge.wagerAmount,
      expiresAt: challenge.expiresAt
    }
  }));

  // Batch insert notifications (you'll need to implement this table/logic)
  // await db.insert(notifications).values(notifications);

  // Send push notifications to online users
  // This would integrate with your real-time notification system

  return experts.rows.length;
}
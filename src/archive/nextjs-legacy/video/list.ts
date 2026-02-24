// api/video/list.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '../../src/server/db';
import { videos, items } from '../../src/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userVideos = await db.select({
      video: videos,
      item: {
        id: items.id,
        name: items.name,
        category: items.category
      }
    })
    .from(videos)
    .leftJoin(items, eq(videos.itemId, items.id))
    .where(eq(videos.userId, session.user.id))
    .orderBy(desc(videos.createdAt))
    .limit(50);

    return NextResponse.json(
      userVideos.map(({ video, item }) => ({
        ...video,
        item
      }))
    );
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch videos' 
    }, { status: 500 });
  }
}
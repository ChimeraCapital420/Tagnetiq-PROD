// api/video/status/[videoId].ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '../../../src/server/db';
import { videos } from '../../../src/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const video = await db.select().from(videos)
      .where(
        and(
          eq(videos.id, params.videoId),
          eq(videos.userId, session.user.id)
        )
      )
      .limit(1);

    if (!video.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = video[0];
    
    // Calculate progress based on estimated time
    let progress = 0;
    if (videoData.status === 'processing' && videoData.createdAt) {
      const elapsed = Date.now() - videoData.createdAt.getTime();
      const estimatedDuration = getEstimatedProcessingTime(videoData.duration || 60);
      progress = Math.min(95, (elapsed / (estimatedDuration * 1000)) * 100);
    } else if (videoData.status === 'completed') {
      progress = 100;
    }

    return NextResponse.json({
      id: videoData.id,
      videoId: videoData.videoId,
      status: videoData.status,
      videoUrl: videoData.videoUrl,
      progress
    });
  } catch (error) {
    console.error('Error fetching video status:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch video status' 
    }, { status: 500 });
  }
}

function getEstimatedProcessingTime(duration: number): number {
  return Math.max(30, duration * 2);
}
// api/video/generate.ts (NOT src/pages/api/video/generate.ts)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '../../src/server/db';
import { items, videos } from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { invideoClient, VideoGenerationSchema } from '../../src/lib/invideo/client';
import { generateVideoScript } from '../../src/lib/video/script-generator';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { itemId, platform, vibe, customScript } = body;

    // Fetch the item from the database
    const item = await db.select().from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item.length || item[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Item not found or unauthorized' }, { status: 404 });
    }

    const itemData = item[0];
    
    // Generate video script if not provided
    const script = customScript || await generateVideoScript({
      itemName: itemData.name,
      category: itemData.category,
      analysis: itemData.analysisResult,
      platform,
      vibe
    });

    // Determine target audience based on category
    const targetAudience = getTargetAudience(itemData.category);

    // Validate parameters
    const params = VideoGenerationSchema.parse({
      script,
      topic: `${itemData.name} - ${itemData.category} Showcase`,
      vibe: vibe || 'professional',
      targetAudience,
      platform
    });

    // Generate video using Invideo API
    const videoResponse = await invideoClient.generateVideo(params);

    // Store video record in database
    const [videoRecord] = await db.insert(videos).values({
      itemId: itemData.id,
      userId: session.user.id,
      platform,
      vibe,
      script,
      videoUrl: videoResponse.videoUrl,
      videoId: videoResponse.videoId,
      duration: videoResponse.duration,
      thumbnailUrl: videoResponse.thumbnailUrl,
      status: 'processing',
      createdAt: new Date()
    }).returning();

    // Start background job to check video status
    startVideoStatusCheck(videoRecord.id, videoResponse.videoId);

    return NextResponse.json({
      success: true,
      video: {
        id: videoRecord.id,
        videoId: videoResponse.videoId,
        status: 'processing',
        estimatedTime: getEstimatedProcessingTime(videoResponse.duration)
      }
    });
  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json({ 
      error: 'Failed to generate video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions remain the same...
function getTargetAudience(category: string): string {
  const audienceMap: Record<string, string> = {
    'watches': 'Luxury watch collectors and enthusiasts',
    'coins': 'Numismatists and coin collectors',
    'stamps': 'Philatelists and stamp collectors',
    'trading-cards': 'Trading card collectors and gamers',
    'comics': 'Comic book collectors and pop culture enthusiasts',
    'jewelry': 'Jewelry collectors and luxury enthusiasts',
    'art': 'Art collectors and investment professionals',
    'memorabilia': 'Sports and entertainment memorabilia collectors'
  };

  return audienceMap[category] || 'Collectors and enthusiasts';
}

function getEstimatedProcessingTime(duration: number): number {
  // Estimate 2 seconds of processing per second of video
  return Math.max(30, duration * 2);
}

async function startVideoStatusCheck(videoRecordId: string, invideoVideoId: string) {
  // This would be better implemented with a proper job queue
  // For now, we'll use a simple setTimeout approach
  const checkStatus = async () => {
    try {
      const status = await invideoClient.getVideoStatus(invideoVideoId);
      
      await db.update(videos)
        .set({ 
          status: status.status,
          videoUrl: status.videoUrl || undefined,
          updatedAt: new Date()
        })
        .where(eq(videos.id, videoRecordId));

      if (status.status === 'processing') {
        // Check again in 10 seconds
        setTimeout(checkStatus, 10000);
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      // Retry after 30 seconds on error
      setTimeout(checkStatus, 30000);
    }
  };

  // Start checking after 5 seconds
  setTimeout(checkStatus, 5000);
}
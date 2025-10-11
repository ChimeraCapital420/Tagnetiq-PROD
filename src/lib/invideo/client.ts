// src/lib/invideo/client.ts
import { z } from 'zod';

const INVIDEO_API_KEY = process.env.INVIDEO_API_KEY || '';
const INVIDEO_BASE_URL = 'https://api.invideo.io/v1';

export const VideoGenerationSchema = z.object({
  script: z.string(),
  topic: z.string(),
  vibe: z.enum(['educational', 'entertaining', 'professional', 'casual', 'luxury']),
  targetAudience: z.string(),
  platform: z.enum(['youtube', 'instagram', 'tiktok'])
});

export type VideoGenerationParams = z.infer<typeof VideoGenerationSchema>;

export interface VideoGenerationResponse {
  videoUrl: string;
  videoId: string;
  duration: number;
  thumbnailUrl?: string;
}

export class InvideoClient {
  private apiKey: string;

  constructor(apiKey: string = INVIDEO_API_KEY) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error('Invideo API key is required');
    }
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${INVIDEO_BASE_URL}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          script: params.script,
          topic: params.topic,
          vibe: params.vibe,
          targetAudience: params.targetAudience,
          platform: params.platform
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Invideo API error: ${error.message || response.statusText}`);
      }

      const data = await response.json();
      
      return {
        videoUrl: data.videoUrl,
        videoId: data.videoId,
        duration: data.duration,
        thumbnailUrl: data.thumbnailUrl
      };
    } catch (error) {
      console.error('Error generating video:', error);
      throw error;
    }
  }

  async getVideoStatus(videoId: string): Promise<{ status: 'processing' | 'completed' | 'failed'; videoUrl?: string }> {
    try {
      const response = await fetch(`${INVIDEO_BASE_URL}/video-status/${videoId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get video status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting video status:', error);
      throw error;
    }
  }
}

export const invideoClient = new InvideoClient();
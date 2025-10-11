// src/hooks/useVideoGeneration.ts
import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface VideoGenerationParams {
  itemId: string;
  platform: 'youtube' | 'instagram' | 'tiktok';
  vibe: 'educational' | 'entertaining' | 'professional' | 'casual' | 'luxury';
  customScript?: string;
}

interface VideoStatus {
  id: string;
  videoId: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress?: number;
}

export function useVideoGeneration() {
  const [currentVideo, setCurrentVideo] = useState<VideoStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  // Generate video mutation
  const generateMutation = useMutation({
    mutationFn: async (params: VideoGenerationParams) => {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate video');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCurrentVideo({
        id: data.video.id,
        videoId: data.video.videoId,
        status: 'processing',
        progress: 0
      });
      
      // Start polling for status
      pollVideoStatus(data.video.id);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Check video status
  const checkVideoStatus = useCallback(async (videoId: string): Promise<VideoStatus> => {
    const response = await fetch(`/api/video/status/${videoId}`);
    
    if (!response.ok) {
      throw new Error('Failed to check video status');
    }

    return response.json();
  }, []);

  // Poll for video status
  const pollVideoStatus = useCallback((videoId: string) => {
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes max
    const pollInterval = 5000; // 5 seconds

    const poll = async () => {
      try {
        const status = await checkVideoStatus(videoId);
        
        // Update progress
        if (status.status === 'processing' && status.progress) {
          setProgress(status.progress);
        }

        // Update current video status
        setCurrentVideo(prev => ({ ...prev, ...status }));

        if (status.status === 'completed') {
          setProgress(100);
          toast.success('Video generated successfully!', {
            action: {
              label: 'View',
              onClick: () => window.open(status.videoUrl, '_blank')
            }
          });
          
          // Invalidate queries to refresh video list
          queryClient.invalidateQueries({ queryKey: ['videos'] });
        } else if (status.status === 'failed') {
          toast.error('Video generation failed. Please try again.');
          setCurrentVideo(null);
          setProgress(0);
        } else if (pollCount < maxPolls) {
          // Continue polling
          setTimeout(poll, pollInterval);
          pollCount++;
        } else {
          // Timeout
          toast.error('Video generation timed out. Please check back later.');
          setCurrentVideo(null);
          setProgress(0);
        }
      } catch (error) {
        console.error('Error polling video status:', error);
        // Retry after a longer delay
        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval * 2);
          pollCount++;
        }
      }
    };

    // Start polling
    poll();
  }, [checkVideoStatus, queryClient]);

  // Get user's videos
  const videosQuery = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await fetch('/api/video/list');
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      return response.json();
    }
  });

  return {
    generateVideo: generateMutation.mutate,
    isGenerating: generateMutation.isPending || currentVideo?.status === 'processing',
    checkStatus: checkVideoStatus,
    currentVideo,
    progress,
    videos: videosQuery.data,
    isLoadingVideos: videosQuery.isLoading
  };
}
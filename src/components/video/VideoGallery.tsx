// src/components/video/VideoGallery.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Play, Download, Share2, Eye, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useVideoGeneration } from '../../hooks/useVideoGeneration';

interface VideoGalleryProps {
  itemId?: string;
  userId?: string;
}

export default function VideoGallery({ itemId, userId }: VideoGalleryProps) {
  const { videos, isLoadingVideos } = useVideoGeneration();

  const filteredVideos = videos?.filter(v => 
    (!itemId || v.itemId === itemId) && 
    (!userId || v.userId === userId)
  );

  const statusIcons = {
    processing: <Loader2 className="w-4 h-4 animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />
  };

  const platformColors = {
    youtube: 'bg-red-500',
    instagram: 'bg-gradient-to-br from-purple-500 to-pink-500',
    tiktok: 'bg-black'
  };

  if (isLoadingVideos) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!filteredVideos?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No videos generated yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredVideos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="overflow-hidden bg-black/40 border-white/10">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-white/5">
              {video.thumbnailUrl ? (
                <img 
                  src={video.thumbnailUrl} 
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-12 h-12 text-white/20" />
                </div>
              )}
              
              {/* Status Overlay */}
              {video.status !== 'completed' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    {statusIcons[video.status]}
                    <p className="mt-2 text-sm capitalize">{video.status}</p>
                  </div>
                </div>
              )}

              {/* Platform Badge */}
              <div className="absolute top-2 left-2">
                <Badge 
                  className={`${platformColors[video.platform]} text-white border-0`}
                >
                  {video.platform}
                </Badge>
              </div>

              {/* Duration */}
              {video.duration && (
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(video.duration)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium capitalize">{video.vibe} Style</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {video.views !== undefined && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    {video.views}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {video.status === 'completed' && video.videoUrl && (
                  <>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => window.open(video.videoUrl, '_blank')}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Watch
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(video.videoUrl!, video.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShare(video.videoUrl!, video.platform)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {video.status === 'processing' && (
                  <Button variant="secondary" size="sm" disabled className="flex-1">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Processing...
                  </Button>
                )}
                {video.status === 'failed' && (
                  <Button variant="secondary" size="sm" disabled className="flex-1">
                    <XCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function handleDownload(videoUrl: string, videoId: string) {
  try {
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tagnetiq-video-${videoId}.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    toast.error('Failed to download video');
  }
}

function handleShare(videoUrl: string, platform: string) {
  if (navigator.share) {
    navigator.share({
      title: `Check out my ${platform} video!`,
      text: 'Created with Tagnetiq AI',
      url: videoUrl
    }).catch(() => {
      // User cancelled share
    });
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(videoUrl);
    toast.success('Video link copied to clipboard!');
  }
}
// src/components/video/VideoGenerator.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoGeneration } from '../../hooks/useVideoGeneration';
import { Loader2, Video, Youtube, Instagram, Music, Sparkles, Edit3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';

interface VideoGeneratorProps {
  itemId: string;
  itemName: string;
  category: string;
  analysisResult?: any;
  onVideoGenerated?: (videoId: string) => void;
}

export default function VideoGenerator({ 
  itemId, 
  itemName, 
  category, 
  analysisResult,
  onVideoGenerated 
}: VideoGeneratorProps) {
  const [platform, setPlatform] = useState<'youtube' | 'instagram' | 'tiktok'>('youtube');
  const [vibe, setVibe] = useState<'educational' | 'entertaining' | 'professional' | 'casual' | 'luxury'>('professional');
  const [customScript, setCustomScript] = useState('');
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  
  const { generateVideo, checkStatus, isGenerating, progress, currentVideo } = useVideoGeneration();

  const platformConfig = {
    youtube: { 
      icon: Youtube, 
      name: 'YouTube', 
      color: 'bg-red-500',
      aspectRatio: '16:9',
      maxDuration: '10 minutes'
    },
    instagram: { 
      icon: Instagram, 
      name: 'Instagram Reel', 
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      aspectRatio: '9:16',
      maxDuration: '90 seconds'
    },
    tiktok: { 
      icon: Music, 
      name: 'TikTok', 
      color: 'bg-black',
      aspectRatio: '9:16',
      maxDuration: '3 minutes'
    }
  };

  const vibeConfig = {
    educational: { emoji: '📚', description: 'Informative and detailed' },
    entertaining: { emoji: '🎉', description: 'Fun and engaging' },
    professional: { emoji: '💼', description: 'Serious and authoritative' },
    casual: { emoji: '😊', description: 'Friendly and approachable' },
    luxury: { emoji: '💎', description: 'Elegant and sophisticated' }
  };

  const handleGenerate = async () => {
    try {
      const videoId = await generateVideo({
        itemId,
        platform,
        vibe,
        customScript: showScriptEditor ? customScript : undefined
      });

      if (videoId && onVideoGenerated) {
        onVideoGenerated(videoId);
      }

      toast.success('Video generation started! We\'ll notify you when it\'s ready.');
    } catch (error) {
      toast.error('Failed to generate video. Please try again.');
      console.error('Video generation error:', error);
    }
  };

  const PlatformIcon = platformConfig[platform].icon;

  return (
    <Card className="p-6 space-y-6 bg-black/40 border-white/10">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Video className="w-5 h-5" />
          Generate Video Content
        </h3>
        
        <p className="text-sm text-muted-foreground">
          Transform your {itemName} into engaging video content for social media.
        </p>
      </div>

      {/* Platform Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Platform</label>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(platformConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setPlatform(key as any)}
                className={`
                  relative p-4 rounded-lg border transition-all
                  ${platform === key 
                    ? 'border-primary bg-primary/10' 
                    : 'border-white/10 hover:border-white/20'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium">{config.name}</span>
                </div>
                {platform === key && (
                  <motion.div
                    layoutId="platform-selector"
                    className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Aspect Ratio: {platformConfig[platform].aspectRatio}</span>
          <span>Max Duration: {platformConfig[platform].maxDuration}</span>
        </div>
      </div>

      {/* Vibe Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Video Style</label>
        <Select value={vibe} onValueChange={(v: any) => setVibe(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(vibeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span>{config.emoji}</span>
                  <span className="font-medium capitalize">{key}</span>
                  <span className="text-xs text-muted-foreground">- {config.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Script Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Script</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowScriptEditor(!showScriptEditor)}
            className="gap-1"
          >
            <Edit3 className="w-3 h-3" />
            {showScriptEditor ? 'Use AI Script' : 'Custom Script'}
          </Button>
        </div>
        
        <AnimatePresence>
          {showScriptEditor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Textarea
                placeholder="Enter your custom video script..."
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                className="min-h-[150px] bg-white/5 border-white/10"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Include [BRACKETS] for visual cues and timing, e.g., [CLOSE-UP SHOT - 3 seconds]
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!showScriptEditor && (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">AI-Generated Script</p>
                <p className="text-xs text-muted-foreground">
                  Our AI will create an optimized script based on your item's analysis, 
                  tailored for {platformConfig[platform].name} in a {vibe} style.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Display */}
      {isGenerating && currentVideo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Generating video...</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            This may take a few minutes. You can close this window - we'll notify you when it's ready.
          </p>
        </div>
      )}

      {/* Generate Button */}
      <Button 
        onClick={handleGenerate} 
        disabled={isGenerating || (showScriptEditor && !customScript)}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating Video...
          </>
        ) : (
          <>
            <PlatformIcon className="w-4 h-4 mr-2" />
            Generate {platformConfig[platform].name} Video
          </>
        )}
      </Button>

      {/* Feature Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          AI Script Generation
        </Badge>
        <Badge variant="secondary" className="text-xs">
          <Video className="w-3 h-3 mr-1" />
          Professional Editing
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Platform Optimized
        </Badge>
      </div>
    </Card>
  );
}
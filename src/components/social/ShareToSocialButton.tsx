// FILE: src/components/social/ShareToSocialButton.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Share2, Twitter, Facebook, Linkedin, Link, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ShareToSocialButtonProps {
  analysisResult: any;
}

export const ShareToSocialButton: React.FC<ShareToSocialButtonProps> = ({ analysisResult }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bragCardUrl, setBragCardUrl] = useState<string | null>(null);

  const generateBragCard = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/social/generate-brag-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: analysisResult.itemName,
          estimatedValue: analysisResult.estimatedValue,
          imageUrl: analysisResult.imageUrl,
          confidenceScore: analysisResult.confidenceScore,
          category: analysisResult.category,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate brag card');

      const { bragCardUrl } = await response.json();
      setBragCardUrl(bragCardUrl);
      
    } catch (error) {
      toast.error('Failed to generate sharing image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!bragCardUrl) {
      generateBragCard();
    }
  };

  const shareText = `Just got my ${analysisResult.itemName} valued at $${analysisResult.estimatedValue.toFixed(2)} on @Tagnetiq! 🚀`;
  const shareUrl = `https://tagnetiq.com/share/${analysisResult.id}`;

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  const downloadBragCard = async () => {
    if (!bragCardUrl) return;
    
    try {
      const response = await fetch(bragCardUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tagnetiq-${analysisResult.itemName.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Brag card downloaded!');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  return (
    <>
      <Button 
        variant="secondary" 
        className="w-full" 
        onClick={handleOpen}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share to Social
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Valuation</DialogTitle>
            <DialogDescription>
              Show off your {analysisResult.itemName} valued at ${analysisResult.estimatedValue.toFixed(2)}!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Brag Card Preview */}
            {isGenerating ? (
              <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : bragCardUrl ? (
              <div className="relative">
                <img 
                  src={bragCardUrl} 
                  alt="Brag card" 
                  className="w-full rounded-lg"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  onClick={downloadBragCard}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            ) : null}

            {/* Social Share Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(shareLinks.twitter, '_blank')}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(shareLinks.facebook, '_blank')}
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(shareLinks.linkedin, '_blank')}
              >
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
            </div>

            {/* Copy Link Button */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={copyLink}
            >
              <Link className="h-4 w-4 mr-2" />
              Copy Share Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
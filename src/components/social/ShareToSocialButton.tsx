// FILE: src/components/social/ShareToSocialButton.tsx

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Share2, Twitter, Facebook, Linkedin, Link, Loader2, Download, Camera } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

interface ShareToSocialButtonProps {
  analysisResult: any;
}

export const ShareToSocialButton: React.FC<ShareToSocialButtonProps> = ({ analysisResult }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bragCardDataUrl, setBragCardDataUrl] = useState<string | null>(null);
  const bragCardRef = useRef<HTMLDivElement>(null);

  const generateBragCard = async () => {
    if (!bragCardRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(bragCardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      setBragCardDataUrl(dataUrl);
      
    } catch (error) {
      console.error('Failed to generate brag card:', error);
      toast.error('Failed to generate sharing image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Generate the card when dialog opens
    setTimeout(generateBragCard, 100);
  };

  const shareText = `Just got my ${analysisResult.itemName} valued at $${analysisResult.estimatedValue.toFixed(2)} on @Tagnetiq! 🚀`;
  const shareUrl = `https://tagnetiq.com/share/${analysisResult.id || Date.now()}`;

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  const downloadBragCard = () => {
    if (!bragCardDataUrl) return;
    
    const link = document.createElement('a');
    link.href = bragCardDataUrl;
    link.download = `tagnetiq-${analysisResult.itemName.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Brag card downloaded!');
  };

  const confidenceColor = analysisResult.confidenceScore > 85 ? '#4ade80' : 
                          analysisResult.confidenceScore > 65 ? '#fbbf24' : '#ef4444';

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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Share Your Valuation</DialogTitle>
            <DialogDescription>
              Show off your {analysisResult.itemName} valued at ${analysisResult.estimatedValue.toFixed(2)}!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Hidden Brag Card for Generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              <div 
                ref={bragCardRef}
                style={{
                  width: '1200px',
                  height: '630px',
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%)',
                  color: 'white',
                  padding: '40px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Grid Pattern */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: '30px 30px'
                }} />
                
                {/* Content */}
                <div style={{ position: 'relative', display: 'flex', height: '100%', gap: '60px' }}>
                  {/* Image */}
                  <div style={{
                    width: '400px',
                    height: '400px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img 
                      src={analysisResult.imageUrl} 
                      alt={analysisResult.itemName}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      crossOrigin="anonymous"
                    />
                  </div>
                  
                  {/* Info */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '20px' }}>TAGNETIQ</div>
                    <div style={{
                      background: '#4ade80',
                      color: 'black',
                      padding: '10px 20px',
                      display: 'inline-block',
                      fontWeight: 'bold',
                      fontSize: '18px',
                      marginBottom: '40px',
                      width: 'fit-content'
                    }}>
                      AI VALUATION
                    </div>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '30px', lineHeight: 1.2 }}>
                      {analysisResult.itemName}
                    </div>
                    <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#4ade80', marginBottom: '20px' }}>
                      ${analysisResult.estimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '24px', color: '#a0a0a0', marginBottom: '30px' }}>
                      {analysisResult.category}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px' }}>
                      <span>AI Confidence:</span>
                      <div style={{
                        width: '200px',
                        height: '20px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: '100%',
                          background: confidenceColor,
                          width: `${analysisResult.confidenceScore}%`
                        }} />
                      </div>
                      <span>{Math.round(analysisResult.confidenceScore)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Footer */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: '18px'
                }}>
                  Get your items valued with AI at tagnetiq.com
                </div>
              </div>
            </div>

            {/* Brag Card Preview */}
            {isGenerating ? (
              <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : bragCardDataUrl ? (
              <div className="relative">
                <img 
                  src={bragCardDataUrl} 
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
            ) : (
              <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

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
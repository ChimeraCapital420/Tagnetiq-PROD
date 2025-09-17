// FILE: src/components/vault/VaultItemCard.tsx

import React, { useState, useRef, useEffect } from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Swords, TrendingUp, Eye, Award, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface VaultItemCardProps {
  item: VaultItem;
  onSelect: () => void;
  onStartChallenge: () => void;
}

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

// PERFORMANCE: Lazy loading image component
const LazyVaultImage: React.FC<{ 
  src?: string; 
  alt: string;
  onLoad?: () => void;
  onError?: () => void;
}> = ({ src, alt, onLoad, onError }) => {
  const [isInView, setIsInView] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        // Start loading when image is 50px away from viewport
        rootMargin: '50px',
        threshold: 0
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleImageLoad = () => {
    setHasLoaded(true);
    onLoad?.();
  };

  const handleImageError = () => {
    setHasError(true);
    onError?.();
  };

  const imageSrc = src || '/placeholder.svg';

  return (
    <div ref={imgRef} className="aspect-square w-full overflow-hidden relative bg-muted">
      {/* Loading skeleton */}
      {!hasLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Actual image - only render when in view */}
      {isInView && (
        <img
          src={hasError ? '/placeholder.svg' : imageSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-300 ${
            hasLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          loading="lazy"
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export const VaultItemCard: React.FC<VaultItemCardProps> = ({ item, onSelect, onStartChallenge }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const displayValue = item.owner_valuation
    ? item.owner_valuation.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : item.valuation_data?.estimatedValue
      ? `$${parseFloat(item.valuation_data.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Valuation Pending';

  const aiValue = item.valuation_data?.estimatedValue ? parseFloat(item.valuation_data.estimatedValue) : 0;
  const ownerValue = item.owner_valuation || 0;
  const potentialProfit = Math.max(aiValue, ownerValue) - ownerValue;
  const profitMargin = ownerValue > 0 ? ((potentialProfit / ownerValue) * 100) : 0;
  
  const valueSource = item.owner_valuation ? "Owner Valuation" : "AI Valuation";
  const confidence = item.valuation_data?.confidence || 'medium';
  
  // SYMBIOSIS: Enhanced challenge potential analysis
  const challengePotential = React.useMemo(() => {
    const hasPhotos = item.photos && item.photos.length > 0;
    const hasDocumentation = item.notes || item.serial_number || item.provenance_documents?.length;
    const hasValuation = item.owner_valuation || item.valuation_data?.estimatedValue;
    const hasHighConfidence = confidence === 'high';
    
    let score = 0;
    if (hasPhotos) score += 25;
    if (hasDocumentation) score += 25; 
    if (hasValuation) score += 25;
    if (hasHighConfidence) score += 25;
    
    if (score >= 75) return { level: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-500' };
    if (score >= 50) return { level: 'Good', color: 'text-yellow-400', bgColor: 'bg-yellow-500' };
    return { level: 'Basic', color: 'text-gray-400', bgColor: 'bg-gray-500' };
  }, [item, confidence]);

  const handleChallengeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // SYMBIOSIS: Smart pre-flight validation with user guidance
    const issues: string[] = [];
    if (!item.photos || item.photos.length === 0) {
      issues.push('Add photos for better marketplace visibility');
    }
    if (!item.owner_valuation && (!item.valuation_data?.estimatedValue || parseFloat(item.valuation_data.estimatedValue) === 0)) {
      issues.push('Set a valuation to establish your purchase price');
    }
    
    if (issues.length > 0) {
      toast.info('Optimize your listing first:', {
        description: issues.join(' • '),
        action: {
          label: 'Edit Details',
          onClick: onSelect,
        },
      });
      return;
    }
    
    onStartChallenge();
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <motion.div 
      variants={cardVariants} 
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className="cursor-pointer bg-black/20 backdrop-blur-lg border border-white/10 hover:border-primary transition-all group flex flex-col h-full relative overflow-hidden"
        onClick={onSelect}
      >
        {/* SYMBIOSIS: Challenge readiness indicator */}
        <div className={`absolute top-2 left-2 z-10 w-3 h-3 rounded-full ${challengePotential.bgColor}`} 
             title={`Arena Readiness: ${challengePotential.level}`} />
        
        <CardHeader className="p-0 relative">
          {/* PERFORMANCE: Lazy loaded image */}
          <LazyVaultImage
            src={item.photos?.[0]}
            alt={item.asset_name}
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* SYMBIOSIS: Quick action overlay on hover - only show after image loads */}
          {isHovered && imageLoaded && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2"
            >
              <Button size="sm" variant="secondary" onClick={handleQuickView}>
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button size="sm" onClick={handleChallengeClick}>
                <Swords className="h-4 w-4 mr-1" />
                Arena
              </Button>
            </motion.div>
          )}
        </CardHeader>

        <CardContent className="p-4 flex flex-col flex-grow space-y-3">
          <CardTitle className="text-base font-semibold truncate flex-grow text-gray-100">
            {item.asset_name}
          </CardTitle>
          
          <div className="space-y-2">
            <div>
              <p className="text-lg font-bold text-white">{displayValue}</p>
              <Badge variant={item.owner_valuation ? "secondary" : "outline"} 
                     className="text-xs border-white/20 text-gray-300">
                {valueSource}
              </Badge>
            </div>

            {/* SYMBIOSIS: Profit potential indicator */}
            {potentialProfit > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <div className="text-xs">
                  <span className="text-green-400 font-semibold">
                    +{potentialProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </span>
                  <span className="text-green-300 ml-1">
                    ({profitMargin.toFixed(0)}% ROI potential)
                  </span>
                </div>
              </div>
            )}

            {/* SYMBIOSIS: Arena readiness status */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span className={`${challengePotential.color} font-medium`}>
                  {challengePotential.level} Arena Readiness
                </span>
              </div>
              {confidence === 'high' && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  High Confidence
                </Badge>
              )}
            </div>
          </div>

          {/* SYMBIOSIS: Enhanced challenge button with smart messaging */}
          <Button 
            onClick={handleChallengeClick} 
            className="w-full mt-auto bg-primary hover:bg-primary/80 group/btn"
          >
            <Swords className="h-4 w-4 mr-2" />
            <span>Start Challenge</span>
            <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
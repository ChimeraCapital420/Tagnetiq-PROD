// FILE: src/pages/arena/ChallengeDetail.tsx
// Updated to fetch real listing data from API

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { 
  MessageSquare, Shield, ShieldAlert, Loader2, Award, 
  ExternalLink, ArrowLeft, Package, Clock, Truck, RefreshCw,
  Share2, Heart, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationModal } from '@/components/arena/VerificationModal';
import { LogSaleModal } from '@/components/arena/LogSaleModal';
import { toast } from 'sonner';

interface Listing {
  id: string;
  item_name: string;
  purchase_price: number;
  asking_price: number;
  primary_photo_url: string;
  additional_photos?: string[];
  listing_id: string;
  seller_id: string;
  seller_email: string;
  seller_name?: string;
  possession_verified: boolean;
  status: 'active' | 'completed' | 'verified' | 'expired';
  description?: string;
  condition?: string;
  shipping_included?: boolean;
  accepts_trades?: boolean;
  created_at?: string;
  expires_at?: string;
  roi?: number;
}

const ChallengeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isLogSaleOpen, setIsLogSaleOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) {
        setError('No listing ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/arena/listings/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Listing not found');
          } else {
            const errorData = await response.json();
            setError(errorData.error || 'Failed to load listing');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setListing(data);
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError('Failed to load listing. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  const isOwner = user?.id === listing?.seller_id;

  const allImages = listing ? [
    listing.primary_photo_url,
    ...(listing.additional_photos || [])
  ].filter(Boolean) : [];

  const onVerificationSuccess = () => {
    if (listing) setListing({ ...listing, possession_verified: true });
  };

  const onLogSaleSuccess = (roi: number) => {
    if (listing) setListing({ ...listing, status: 'completed', roi });
  };

  const handleContactSeller = async () => {
    if (!listing) return;
    
    if (!user) {
      toast.error('Please sign in to contact the seller');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await fetch('/api/arena/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: listing.listing_id }),
      });
      navigate('/arena/messages');
    } catch (error) {
      toast.error("Error", { description: (error as any).message });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="container p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading listing...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Oops!</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/arena/marketplace')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Marketplace
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (!listing) {
    return (
      <div className="container p-8 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Listing Not Found</h2>
        <p className="text-muted-foreground mb-4">This listing may have been removed or doesn't exist.</p>
        <Button onClick={() => navigate('/arena/marketplace')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Browse Marketplace
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        {/* Back button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/arena/marketplace')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl">{listing.item_name}</CardTitle>
                <CardDescription className="mt-1">
                  Listed by {listing.seller_name || listing.seller_email}
                  {listing.created_at && (
                    <span className="ml-2">• {formatDate(listing.created_at)}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid md:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              <AspectRatio ratio={1 / 1} className="bg-muted rounded-lg overflow-hidden">
                <img 
                  src={allImages[selectedImage] || '/placeholder.svg'} 
                  alt={listing.item_name} 
                  className="object-cover w-full h-full"
                />
              </AspectRatio>
              
              {/* Thumbnail row */}
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                        selectedImage === idx ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-6">
              {/* Price */}
              <div>
                <p className="text-sm text-muted-foreground">
                  {listing.status === 'completed' ? 'Final Sale Price' : 'Asking Price'}
                </p>
                <p className="text-4xl font-bold">${listing.asking_price.toLocaleString()}</p>
              </div>

              {/* Purchase price (if available) */}
              {listing.purchase_price > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Original Purchase Price</p>
                  <p className="text-xl font-semibold">${listing.purchase_price.toLocaleString()}</p>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {listing.condition && (
                  <Badge variant="secondary">{listing.condition}</Badge>
                )}
                {listing.shipping_included && (
                  <Badge variant="outline" className="gap-1">
                    <Truck className="h-3 w-3" />
                    Free Shipping
                  </Badge>
                )}
                {listing.accepts_trades && (
                  <Badge variant="outline" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Accepts Trades
                  </Badge>
                )}
                {listing.status === 'active' && listing.expires_at && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Expires {formatDate(listing.expires_at)}
                  </Badge>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <div>
                  <p className="text-sm font-medium mb-2">Description</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
                </div>
              )}

              {/* Completed Challenge Banner */}
              {listing.status === 'completed' && listing.roi !== undefined && (
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-primary">Challenge Completed!</p>
                  <p className="text-5xl font-bold text-primary">{listing.roi.toFixed(2)}% ROI</p>
                </div>
              )}

              {/* Owner Actions */}
              {isOwner && listing.status === 'active' && (
                <div className="space-y-3">
                  {!listing.possession_verified ? (
                    <Button size="lg" className="w-full" onClick={() => setIsVerificationOpen(true)}>
                      <ShieldAlert className="mr-2 h-5 w-5" />
                      Verify Possession
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-md">
                      <Shield size={20} />
                      <span className="text-sm font-semibold">Possession Verified</span>
                    </div>
                  )}
                  <Button size="lg" variant="secondary" className="w-full" onClick={() => setIsLogSaleOpen(true)}>
                    <Award className="mr-2 h-5 w-5" />
                    Log Final Sale
                  </Button>
                </div>
              )}

              {/* Buyer Actions */}
              {!isOwner && listing.status === 'active' && (
                <div className="space-y-3">
                  {listing.possession_verified ? (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-md">
                      <Shield size={20} />
                      <span className="text-sm font-semibold">Possession Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-500 rounded-md">
                      <ShieldAlert size={20} />
                      <span className="text-sm font-semibold">Possession Not Yet Verified</span>
                    </div>
                  )}
                  <Button size="lg" className="w-full" onClick={handleContactSeller}>
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Contact Seller
                  </Button>
                </div>
              )}

              {/* Expired/Inactive State */}
              {listing.status !== 'active' && listing.status !== 'completed' && (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground">This listing is no longer active</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {isOwner && listing && (
        <>
          <VerificationModal 
            challengeId={listing.id} 
            isOpen={isVerificationOpen} 
            onClose={() => setIsVerificationOpen(false)} 
            onSuccess={onVerificationSuccess} 
          />
          <LogSaleModal 
            challengeId={listing.id} 
            isOpen={isLogSaleOpen} 
            onClose={() => setIsLogSaleOpen(false)} 
            onSuccess={onLogSaleSuccess} 
          />
        </>
      )}
    </>
  );
};

export default ChallengeDetail;
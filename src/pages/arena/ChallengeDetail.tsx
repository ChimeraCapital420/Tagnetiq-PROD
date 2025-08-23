// FILE: src/pages/arena/ChallengeDetail.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { MessageSquare, Shield, ShieldAlert, Loader2, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationModal } from '@/components/arena/VerificationModal';
import { LogSaleModal } from '@/components/arena/LogSaleModal';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  item_name: string;
  purchase_price: number;
  asking_price: number;
  primary_photo_url: string;
  listing_id: string;
  seller_id: string;
  seller_email: string;
  possession_verified: boolean;
  status: 'active' | 'completed' | 'verified';
  roi?: number;
}

const ChallengeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isLogSaleOpen, setIsLogSaleOpen] = useState(false);

  useEffect(() => {
    const fetchChallenge = async () => {
      setLoading(true);
      // In a real app, you would fetch this from '/api/arena/challenge/:id'
      await new Promise(res => setTimeout(res, 500));
      setChallenge({
        id: id!,
        item_name: 'Vintage Kenner Star Wars Figure',
        purchase_price: 12.50,
        asking_price: 85.00,
        primary_photo_url: '/placeholder.svg',
        listing_id: 'listing-id-placeholder-456',
        seller_id: user?.id || 'user-id-placeholder-123', // Simulate ownership for demo
        seller_email: 'ResaleWizard@example.com',
        possession_verified: false,
        status: 'active',
      });
      setLoading(false);
    };
    fetchChallenge();
  }, [id, user]);
  
  const isOwner = user?.id === challenge?.seller_id;
  
  const onVerificationSuccess = () => {
      if (challenge) setChallenge({ ...challenge, possession_verified: true });
  };
  
  const onLogSaleSuccess = (roi: number) => {
      if (challenge) setChallenge({ ...challenge, status: 'completed', roi });
  };

  const handleContactSeller = async () => {
      if (!challenge) return;
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Not authenticated");
          await fetch('/api/arena/conversations', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ listingId: challenge.listing_id }),
          });
          navigate('/arena/messages');
      } catch (error) {
          toast.error("Error", { description: (error as any).message });
      }
  };

  if (loading) {
    return <div className="container p-8 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!challenge) {
    return <div className="container p-8 text-center"><p>Challenge not found.</p></div>;
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{challenge.item_name}</CardTitle>
            <CardDescription>Listed by {challenge.seller_email}</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8">
            <div>
              <AspectRatio ratio={1 / 1}><img src={challenge.primary_photo_url} alt={challenge.item_name} className="rounded-md object-cover w-full h-full" /></AspectRatio>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">{challenge.status === 'completed' ? 'Final Sale Price' : 'Asking Price'}</p>
                <p className="text-4xl font-bold">${challenge.asking_price.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Original Purchase Price</p>
                <p className="text-xl font-semibold">${challenge.purchase_price.toLocaleString()}</p>
              </div>

              {challenge.status === 'completed' && (
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm text-primary">Challenge Completed!</p>
                    <p className="text-5xl font-bold text-primary">{challenge.roi?.toFixed(2)}% ROI</p>
                </div>
              )}
              
              {isOwner && challenge.status === 'active' && (
                <>
                  {!challenge.possession_verified ? (
                    <Button size="lg" className="w-full" onClick={() => setIsVerificationOpen(true)}><ShieldAlert className="mr-2" />Verify Possession</Button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-md"><Shield size={20} /><span className="text-sm font-semibold">Possession Verified</span></div>
                  )}
                   <Button size="lg" variant="secondary" className="w-full" onClick={() => setIsLogSaleOpen(true)}><Award className="mr-2" />Log Final Sale</Button>
                </>
              )}
              
              {!isOwner && challenge.status === 'active' && (
                 <>
                  {challenge.possession_verified ? (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-md"><Shield size={20} /><span className="text-sm font-semibold">Possession Verified</span></div>
                  ) : (
                     <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-500 rounded-md"><ShieldAlert size={20} /><span className="text-sm font-semibold">Possession Not Yet Verified</span></div>
                  )}
                  <Button size="lg" className="w-full" onClick={handleContactSeller}><MessageSquare className="mr-2" />Contact Seller</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isOwner && (
        <>
            <VerificationModal challengeId={challenge.id} isOpen={isVerificationOpen} onClose={() => setIsVerificationOpen(false)} onSuccess={onVerificationSuccess} />
            <LogSaleModal challengeId={challenge.id} isOpen={isLogSaleOpen} onClose={() => setIsLogSaleOpen(false)} onSuccess={onLogSaleSuccess} />
        </>
      )}
    </>
  );
};

export default ChallengeDetail;
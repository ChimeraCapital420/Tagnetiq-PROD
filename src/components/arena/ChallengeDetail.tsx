import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { MessageSquare, Shield } from 'lucide-react';

const ChallengeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // In a real implementation, you would fetch the challenge data using the id.
  // For now, we'll use placeholder data.
  const challenge = {
    itemName: 'Vintage Kenner Star Wars Figure',
    purchasePrice: '12.50',
    askingPrice: '85.00',
    imageUrl: '/placeholder.svg',
    seller: 'ResaleWizard',
    possessionVerified: true,
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{challenge.itemName}</CardTitle>
          <CardDescription>Listed by {challenge.seller}</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8">
          <div>
            <AspectRatio ratio={1 / 1}>
              <img src={challenge.imageUrl} alt={challenge.itemName} className="rounded-md object-cover w-full h-full" />
            </AspectRatio>
            {challenge.possessionVerified && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-green-500/10 text-green-500 rounded-md">
                <Shield size={20} />
                <span className="text-sm font-semibold">Possession Verified</span>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Asking Price</p>
              <p className="text-4xl font-bold">${challenge.askingPrice}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Original Purchase Price</p>
              <p className="text-xl font-semibold">${challenge.purchasePrice}</p>
            </div>
            <Button size="lg" className="w-full">
              <MessageSquare className="mr-2" />
              Contact Seller
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChallengeDetail;
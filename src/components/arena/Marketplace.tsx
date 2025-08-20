import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const Marketplace: React.FC = () => {
  // In a real implementation, this data would be fetched from your backend.
  const challenges = [
    { id: '1', itemName: 'Vintage Kenner Star Wars Figure', askingPrice: '85.00', imageUrl: '/placeholder.svg' },
    { id: '2', itemName: 'First Edition "Dune" by Frank Herbert', askingPrice: '2,500.00', imageUrl: '/placeholder.svg' },
    // ... more items
  ];

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Discover assets from public ROI challenges.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search the marketplace..." />
          <Button>Search</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {challenges.map(item => (
            <Link to={`/arena/challenge/${item.id}`} key={item.id}>
              <Card className="h-full overflow-hidden hover:border-primary transition-all group">
                <CardHeader className="p-0">
                  <AspectRatio ratio={1 / 1}>
                    <img src={item.imageUrl} alt={item.itemName} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                  </AspectRatio>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="font-semibold truncate">{item.itemName}</p>
                  <p className="text-lg font-bold text-primary">${item.askingPrice}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
// FILE: src/components/investor/ProductDemos.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';

export const ProductDemos: React.FC = () => {
  return (
    <Card>
        <CardHeader>
            <CardTitle>Product Demonstrations</CardTitle>
            <CardDescription>Walkthroughs of core features and modules.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Core Scanning Demo</p>
            </div>
             <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Real Estate Module</p>
            </div>
        </CardContent>
    </Card>
  );
};
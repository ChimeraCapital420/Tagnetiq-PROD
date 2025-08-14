import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const Index: React.FC = () => {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 container mx-auto px-4 py-12 sm:py-24 flex items-center justify-center min-h-screen">
        <Card className="max-w-4xl w-full backdrop-blur-sm border-border/50 bg-background/50">
            <div className="grid md:grid-cols-2 items-center">
              <div className="p-8 text-center md:text-left">
                  <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  The Bloomberg Terminal for Physical Assets
                  </h1>
                  <p className="mt-6 text-lg leading-8 text-muted-foreground">
                  TagnetIQ is an AI-powered resale assistant for smart glasses and mobile platforms.
                  </p>
                  <div className="mt-10 flex items-center justify-center md:justify-start gap-x-6">
                  <Button asChild size="lg">
                      <Link to="/signup">Get Started</Link>
                  </Button>
                  </div>
              </div>
              <div className="p-8">
                  <img 
                  src="/welcome-artwork.jpg" 
                  alt="A first-person view through smart glasses" 
                  className="rounded-lg shadow-2xl"
                  />
              </div>
            </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
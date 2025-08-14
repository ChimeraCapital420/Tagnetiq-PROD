// src/pages/Demo.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Demo: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold">Welcome to the TagnetIQ Demo</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Explore the features of TagnetIQ without creating an account.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link to="/demo-dashboard">Go to Demo Dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default Demo;
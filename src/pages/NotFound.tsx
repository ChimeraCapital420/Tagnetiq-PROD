// src/pages/NotFound.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-9xl font-bold">404</h1>
      <p className="text-2xl mt-4">Page Not Found</p>
      <p className="mt-2 text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild className="mt-6">
        <Link to="/">Go to Homepage</Link>
      </Button>
    </div>
  );
};

export default NotFound;
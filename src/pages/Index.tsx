import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index: React.FC = () => {
  return (
    <div className="relative h-screen w-screen">
      {/* REMOVED: The centered Card component has been deleted.
        ADDED: This fixed container positions the text in the lower-left corner.
      */}
      <div className="fixed bottom-0 left-0 p-8 md:p-12 z-20 max-w-xl">
        <h1 
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}
        >
          The Bloomberg Terminal for Physical Assets
        </h1>
        <p 
          className="mt-6 text-lg leading-8 text-gray-200"
          style={{ textShadow: '0 1px 5px rgba(0,0,0,0.7)' }}
        >
          TagnetIQ is an AI-powered resale assistant for smart glasses and mobile platforms.
        </p>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
      
      {/* REMOVED: The `img` tag for the artwork is no longer needed here
        as the AppShell now handles the full-screen background image.
      */}
    </div>
  );
};

export default Index;
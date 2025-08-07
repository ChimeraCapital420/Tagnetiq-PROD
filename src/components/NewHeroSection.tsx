import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NewHeroSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className="min-h-screen flex items-end justify-center relative pb-32">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754415410477_c9b0a107.png)',
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button 
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-6 text-xl font-semibold rounded-lg shadow-2xl"
          onClick={() => navigate('/signup')}
        >
          Sign Up for Free
        </Button>
      </div>
    </section>
  );
};

export default NewHeroSection;
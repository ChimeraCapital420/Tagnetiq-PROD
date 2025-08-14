import React from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeHero from '@/components/beta/WelcomeHero';

const BetaWelcome: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <WelcomeHero onStart={handleStart} />
    </div>
  );
};

export default BetaWelcome;
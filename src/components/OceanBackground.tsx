import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const OceanBackground: React.FC = () => {
  const { theme } = useAppContext();

  if (theme !== 'ocean') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Ocean background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754139237745_4385d185.png)'
        }}
      />
      
      {/* Subtle overlay for better text readability */}
      <div className="absolute inset-0 bg-blue-900/10" />
      
      {/* Light rays from surface for depth effect */}
      <div className="absolute top-0 left-1/4 w-1 h-32 bg-gradient-to-b from-blue-200 to-transparent opacity-20 transform rotate-12 animate-pulse"/>
      <div className="absolute top-0 left-1/2 w-1 h-40 bg-gradient-to-b from-blue-200 to-transparent opacity-15 transform -rotate-6 animate-pulse" style={{animationDelay: '1s'}}/>
      <div className="absolute top-0 right-1/3 w-1 h-36 bg-gradient-to-b from-blue-200 to-transparent opacity-10 transform rotate-8 animate-pulse" style={{animationDelay: '2s'}}/>
      
      {/* Floating particles */}
      <div className="absolute bottom-20 right-1/4 w-1 h-1 bg-blue-200 rounded-full opacity-40 animate-bounce" style={{animationDuration: '4s'}}/>
      <div className="absolute bottom-40 right-1/3 w-1 h-1 bg-blue-200 rounded-full opacity-30 animate-bounce" style={{animationDelay: '1s', animationDuration: '5s'}}/>
      <div className="absolute bottom-60 right-1/2 w-1 h-1 bg-blue-200 rounded-full opacity-20 animate-bounce" style={{animationDelay: '2s', animationDuration: '6s'}}/>
    </div>
  );
};

export default OceanBackground;
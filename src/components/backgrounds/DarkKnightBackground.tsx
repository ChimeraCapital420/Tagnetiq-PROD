// src/components/backgrounds/DarkKnightBackground.tsx
import React, { useState, useEffect } from 'react';

const DarkKnightBackground: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [spotlightPosition, setSpotlightPosition] = useState({ x: '50%', y: '50%' });

  useEffect(() => {
    const animationInterval = setInterval(() => {
      // Pause the animation
      setIsPaused(true);
      // Set a random position for the Q logo to appear
      setSpotlightPosition({
        x: `${Math.random() * 60 + 20}%`, // Avoid edges
        y: `${Math.random() * 40 + 20}%`, // Avoid edges
      });

      // After a short pause, resume the animation
      setTimeout(() => {
        setIsPaused(false);
      }, 4000); // The Q logo will be visible for 4 seconds

    }, 12000); // Pause every 12 seconds

    return () => clearInterval(animationInterval);
  }, []);

  return (
    <>
      <style>{`
        @keyframes panSpotlight {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 50%; }
          50% { background-position: 100% 0%; }
          75% { background-position: 0% 0%; }
          100% { background-position: 0% 50%; }
        }

        .spotlight-overlay {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(circle at center, rgba(255, 255, 220, 0.08) 0%, transparent 20%);
          animation-name: panSpotlight;
          animation-duration: 25s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        .q-logo-container {
          position: fixed;
          inset: 0;
          z-index: 1; 
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.5s ease-in-out;
          pointer-events: none;
        }

        .q-logo-spotlight {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(255, 255, 220, 0.25) 10%, transparent 70%);
          mask-image: url('/images/logo.jpg');
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
        }
      `}</style>
      
      {/* The static background image */}
      <div 
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/dark-knight-bg.jpg)' }}
      />
      
      {/* The continuously panning spotlight */}
      <div 
        className="spotlight-overlay"
        style={{ 
          animationPlayState: isPaused ? 'paused' : 'running',
          backgroundPosition: isPaused ? `${spotlightPosition.x} ${spotlightPosition.y}` : undefined
        }} 
      />
      
      {/* The "Q" Logo, which appears only when the animation is paused */}
      <div 
        className="q-logo-container"
        style={{ opacity: isPaused ? 1 : 0 }}
      >
        <div 
          className="q-logo-spotlight"
          style={{ 
            transform: `translate(${spotlightPosition.x}, ${spotlightPosition.y})`
          }}
        />
      </div>
    </>
  );
};

export default DarkKnightBackground;
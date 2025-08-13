import React, { useEffect, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';

const DarkKnightBackground: React.FC = () => {
  const { theme } = useAppContext();
  const [spotlight1, setSpotlight1] = useState({ x: 20, y: 30, angle: 0 });
  const [spotlight2, setSpotlight2] = useState({ x: 80, y: 70, angle: 180 });
  const [showLogo, setShowLogo] = useState(false);
  const [meetPoint, setMeetPoint] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (theme !== 'darkKnight') return;

    const interval = setInterval(() => {
      setSpotlight1(prev => ({
        x: 20 + Math.sin(Date.now() * 0.0008) * 30,
        y: 30 + Math.cos(Date.now() * 0.0006) * 25,
        angle: prev.angle + 0.5
      }));

      setSpotlight2(prev => ({
        x: 80 + Math.sin(Date.now() * 0.0007) * 25,
        y: 70 + Math.cos(Date.now() * 0.0009) * 30,
        angle: prev.angle - 0.3
      }));

      // Check if spotlights should meet
      const distance = Math.sqrt(
        Math.pow(spotlight1.x - spotlight2.x, 2) + 
        Math.pow(spotlight1.y - spotlight2.y, 2)
      );

      if (distance < 15 && Math.random() > 0.7) {
        const newMeetPoint = {
          x: Math.random() * 60 + 20,
          y: Math.random() * 60 + 20
        };
        setMeetPoint(newMeetPoint);
        setShowLogo(true);
        setTimeout(() => setShowLogo(false), 3000);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [theme, spotlight1.x, spotlight1.y, spotlight2.x, spotlight2.y]);

  if (theme !== 'darkKnight') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Cityscape background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754110888409_bf01da43.png')`,
          opacity: 0.8
        }}
      />
      
      {/* Dark overlay for depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at top, 
              rgba(0, 0, 0, 0.3) 0%, 
              rgba(0, 0, 0, 0.6) 40%, 
              rgba(0, 0, 0, 0.8) 100%
            )
          `
        }}
      />
      
      {/* Spotlight 1 */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-30 transition-all duration-100 ease-linear"
        style={{
          left: `${spotlight1.x}%`,
          top: `${spotlight1.y}%`,
          transform: `translate(-50%, -50%) rotate(${spotlight1.angle}deg)`,
          background: `
            radial-gradient(ellipse 200px 400px at center,
              rgba(255, 215, 0, 0.4) 0%,
              rgba(255, 215, 0, 0.2) 30%,
              rgba(255, 215, 0, 0.1) 60%,
              transparent 100%
            )
          `
        }}
      />

      {/* Spotlight 2 */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-30 transition-all duration-100 ease-linear"
        style={{
          left: `${spotlight2.x}%`,
          top: `${spotlight2.y}%`,
          transform: `translate(-50%, -50%) rotate(${spotlight2.angle}deg)`,
          background: `
            radial-gradient(ellipse 200px 400px at center,
              rgba(255, 215, 0, 0.4) 0%,
              rgba(255, 215, 0, 0.2) 30%,
              rgba(255, 215, 0, 0.1) 60%,
              transparent 100%
            )
          `
        }}
      />

      {/* Tagnetiq Q Logo Shadow */}
      {showLogo && (
        <div
          className="absolute transition-opacity duration-1000"
          style={{
            left: `${meetPoint.x}%`,
            top: `${meetPoint.y}%`,
            transform: 'translate(-50%, -50%)',
            opacity: showLogo ? 1 : 0
          }}
        >
          <div 
            className="text-8xl font-bold text-black opacity-60"
            style={{ 
              textShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
              fontFamily: 'serif'
            }}
          >
            Q
          </div>
        </div>
      )}
    </div>
  );
};

export default DarkKnightBackground;
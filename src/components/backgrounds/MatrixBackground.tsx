import React from 'react';
import './animations.css';

const MatrixBackground: React.FC = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const streamCount = 150;

  return (
    <div className="matrix-rain-bg">
      {[...Array(streamCount)].map((_, i) => {
        const stream = Array.from({ length: Math.floor(Math.random() * 20) + 10 }, () => 
          characters[Math.floor(Math.random() * characters.length)]
        ).join('');
        
        return (
          <p key={i} className="matrix-stream" style={{
            left: `${Math.random() * 100}vw`,
            animationDuration: `${Math.random() * 5 + 3}s`,
            animationDelay: `${Math.random() * 5}s`,
          }}>
            {stream}
          </p>
        );
      })}
    </div>
  );
};

export default MatrixBackground;
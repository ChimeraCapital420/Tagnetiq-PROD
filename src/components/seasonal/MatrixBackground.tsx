// src/components/MatrixBackground.tsx
import React from 'react';

const MatrixBackground: React.FC = () => {
  const matrixStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    overflow: 'hidden',
    background: '#000',
    color: '#0F0',
    fontFamily: 'monospace',
    fontSize: '16px',
    textAlign: 'center',
    pointerEvents: 'none',
  };

  const rainStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0',
    animation: 'fall 1s linear infinite',
  };

  const chars = '0123456789ABCDEF'.split('');
  const streamCount = Math.floor(window.innerWidth / 20);

  return (
    <div style={matrixStyle}>
      {[...Array(streamCount)].map((_, i) => (
        <p key={i} style={{...rainStyle, left: `${(i / streamCount) * 100}%`, animationDelay: `${Math.random()}s`}}>
          {chars[Math.floor(Math.random() * chars.length)]}
        </p>
      ))}
      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};

export default MatrixBackground;
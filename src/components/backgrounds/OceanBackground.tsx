import React from 'react';

const OceanBackground: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes rise {
          to { transform: translateY(-110vh) scale(1.2); }
        }
        .bubble {
          position: fixed; bottom: -10vh; z-index: 0; pointer-events: none;
          background: rgba(255, 255, 255, 0.15); border-radius: 50%;
          animation: rise linear infinite;
        }
      `}</style>
      <div 
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/ocean-bg.jpg)' }}
      />
      {[...Array(15)].map((_, i) => (
        <div key={i} className="bubble" style={{
          left: `${Math.random() * 100}vw`,
          animationDuration: `${Math.random() * 8 + 7}s`,
          animationDelay: `${Math.random() * 10}s`,
          width: `${Math.random() * 20 + 5}px`, height: `${Math.random() * 20 + 5}px`,
        }}/>
      ))}
    </>
  );
};

export default OceanBackground;
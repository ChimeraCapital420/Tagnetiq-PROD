import React from 'react';

const ForestBackground: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes drift {
          from { transform: translateX(-100%); } to { transform: translateX(100%); }
        }
        .wisp {
          position: fixed; left: 0; width: 200%; height: 200px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          animation: drift ease-in-out infinite;
          pointer-events: none; z-index: 0;
        }
      `}</style>
      <div 
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/forest-bg.jpg)' }}
      />
      <div className="wisp" style={{ top: '20%', animationDuration: '45s' }} />
      <div className="wisp" style={{ top: '40%', animationDuration: '60s', animationDelay: '15s' }} />
    </>
  );
};

export default ForestBackground;
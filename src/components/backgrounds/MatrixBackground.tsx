import React from 'react';

const MatrixBackground: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes fall {
          to { transform: translateY(105vh); }
        }
        .matrix-stream {
          writing-mode: vertical-rl; text-orientation: upright; white-space: nowrap;
          user-select: none; text-shadow: 0 0 8px rgba(32, 194, 14, 0.8);
          position: absolute; top: -100%; animation: fall linear infinite; pointer-events: none;
        }
      `}</style>
      <div className="fixed inset-0 z-0" style={{ background: '#000', color: '#20c20e' }}>
        {[...Array(100)].map((_, i) => {
          const streamText = Math.random() < 0.05 ? 'TAGNETIQ' : '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789Z';
          return (
            <div key={i} className="matrix-stream" style={{
              left: `${Math.random() * 100}vw`, fontSize: `${Math.random() * 12 + 12}px`,
              animationDuration: `${Math.random() * 8 + 4}s`, animationDelay: `${Math.random() * 5}s`,
            }}>
              {streamText}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MatrixBackground;
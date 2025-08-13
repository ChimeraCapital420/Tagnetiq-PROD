import React, { useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';

const CyberpunkBackground: React.FC = () => {
  const { theme } = useAppContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== 'cyberpunk') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId: number;
    let time = 0;

    // Load the new cyberpunk cityscape background
    const backgroundImg = new Image();
    backgroundImg.src = 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754140245666_429d7c99.png';

    backgroundImg.onload = () => {
      animate();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      // Draw the cyberpunk cityscape background
      if (backgroundImg.complete) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        
        // Scale and position the background to cover the entire canvas
        const scale = Math.max(canvas.width / backgroundImg.width, canvas.height / backgroundImg.height);
        const scaledWidth = backgroundImg.width * scale;
        const scaledHeight = backgroundImg.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(backgroundImg, x, y, scaledWidth, scaledHeight);
        ctx.restore();
      }

      // Add subtle animated overlay effects
      ctx.save();
      ctx.globalAlpha = 0.1 + Math.sin(time) * 0.05;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      animationId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  if (theme !== 'cyberpunk') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.9 }}
    />
  );
};

export default CyberpunkBackground;
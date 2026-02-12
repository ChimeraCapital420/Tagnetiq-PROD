// FILE: src/components/OracleVisualizer.tsx
// Oracle Visual Presence — Enhanced with user preference support
// FIXED: React hooks violation — conditional return was before useEffect.
//        Now all hooks run unconditionally; rendering is controlled via JSX.

import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { useTts } from '@/hooks/useTts';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Lazy load visualizers for better performance
const CymaticVisualizer = lazy(() => import('./oracle/CymaticVisualizer'));
const GenerativeVisualizer = lazy(() => import('./oracle/GenerativeVisualizer'));

const OracleVisualizer: React.FC = () => {
  const { isSpeaking } = useTts();
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  // Get user's visualizer preference
  const visualizerType = profile?.settings?.oracle_visualizer_preference || 'default';
  const useCustomVisualizer = visualizerType !== 'default';

  // Default visualizer canvas animation
  // This hook ALWAYS runs (React rules) but only draws when conditions are met
  useEffect(() => {
    // Skip if using a custom visualizer or not speaking
    if (useCustomVisualizer || !isSpeaking) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = undefined;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let time = 0;

    const resizeHandler = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.1;

      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const radius = baseRadius + i * 20;
        const lineOpacity = 1 - i / 5;
        ctx.strokeStyle = `rgba(0, 255, 255, ${lineOpacity * 0.7})`;

        for (let angle = 0; angle < 360; angle += 2) {
          const radian = angle * (Math.PI / 180);
          const noise =
            (Math.sin(radian * 8 + time * 0.05 + i * 0.5) +
              Math.cos(radian * 6 - time * 0.03)) *
            10;
          const r = radius + noise;
          const x = centerX + r * Math.cos(radian);
          const y = centerY + r * Math.sin(radian);

          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }

      time++;
      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = undefined;
      }
    };
  }, [isSpeaking, useCustomVisualizer]);

  // ── Render ────────────────────────────────────────────────

  // Custom visualizer (cymatic / generative)
  if (useCustomVisualizer && isSpeaking) {
    return (
      <Suspense fallback={null}>
        {visualizerType === 'cymatic' ? (
          <CymaticVisualizer />
        ) : visualizerType === 'generative' ? (
          <GenerativeVisualizer />
        ) : null}
      </Suspense>
    );
  }

  // Default canvas visualizer (or hidden when not speaking)
  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] pointer-events-none transition-opacity duration-500',
        isSpeaking ? 'opacity-100' : 'opacity-0',
      )}
    >
      <canvas
        ref={canvasRef}
        style={{
          maskImage: 'radial-gradient(circle, white 20%, transparent 50%)',
          WebkitMaskImage: 'radial-gradient(circle, white 20%, transparent 50%)',
        }}
      />
    </div>
  );
};

export default OracleVisualizer;
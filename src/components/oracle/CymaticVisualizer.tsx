// FILE: src/components/oracle/CymaticVisualizer.tsx
// Cymatic-inspired visualizer — organic, flowing interference patterns
// Reacts to Oracle speaking state via global events
// Mobile-first: Uses requestAnimationFrame, respects reduced-motion

import React, { useEffect, useRef } from 'react';
import { useOracleSpeakingState } from '@/hooks/useTts';

const CymaticVisualizer: React.FC = () => {
  const isSpeaking = useOracleSpeakingState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const timeRef = useRef(0);
  const intensityRef = useRef(0); // Smoothly ramps up/down

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const resizeHandler = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      const targetIntensity = isSpeaking ? 1 : 0;
      // Smooth ramp: 0.03 = ~0.5s ramp up, 0.02 = ~0.75s ramp down
      const rampSpeed = isSpeaking ? 0.03 : 0.02;
      intensityRef.current += (targetIntensity - intensityRef.current) * rampSpeed;

      // Stop animating when fully faded out
      if (intensityRef.current < 0.005 && !isSpeaking) {
        ctx.clearRect(0, 0, width, height);
        animationFrameId.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const intensity = intensityRef.current;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.35;
      const time = timeRef.current;

      if (prefersReducedMotion) {
        // Simplified: just a pulsing ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 * intensity})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // ── Cymatic interference pattern ──────────────────
        // Multiple wave sources creating interference
        const sources = [
          { x: centerX, y: centerY, freq: 0.02, phase: time * 0.015 },
          { x: centerX - maxRadius * 0.3, y: centerY, freq: 0.025, phase: time * 0.02 + 1 },
          { x: centerX + maxRadius * 0.3, y: centerY, freq: 0.025, phase: time * 0.02 + 2 },
          { x: centerX, y: centerY - maxRadius * 0.25, freq: 0.03, phase: time * 0.018 + 3 },
        ];

        const resolution = 4; // Pixel skip for performance on mobile
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y += resolution) {
          for (let x = 0; x < width; x += resolution) {
            // Distance from center (for vignette)
            const dx = (x - centerX) / maxRadius;
            const dy = (y - centerY) / maxRadius;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);

            // Skip pixels outside the circular area
            if (distFromCenter > 1.5) continue;

            // Sum waves from all sources
            let waveSum = 0;
            for (const source of sources) {
              const sdx = x - source.x;
              const sdy = y - source.y;
              const dist = Math.sqrt(sdx * sdx + sdy * sdy);
              waveSum += Math.sin(dist * source.freq + source.phase);
            }

            // Normalize to 0-1
            const normalized = (waveSum / sources.length + 1) / 2;

            // Vignette: fade out near edges
            const vignette = Math.max(0, 1 - distFromCenter * 0.8);

            // Color: cyan to blue gradient based on wave value
            const alpha = normalized * vignette * intensity * 0.6;

            if (alpha > 0.01) {
              const r = Math.floor(normalized * 30);
              const g = Math.floor(150 + normalized * 105);
              const b = 255;
              const a = Math.floor(alpha * 255);

              // Fill the resolution block
              for (let py = 0; py < resolution && y + py < height; py++) {
                for (let px = 0; px < resolution && x + px < width; px++) {
                  const idx = ((y + py) * width + (x + px)) * 4;
                  data[idx] = r;
                  data[idx + 1] = g;
                  data[idx + 2] = b;
                  data[idx + 3] = a;
                }
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // ── Ring overlays for extra depth ──────────────────
        for (let i = 0; i < 3; i++) {
          const ringRadius = maxRadius * (0.3 + i * 0.2) + Math.sin(time * 0.02 + i) * 15;
          const ringAlpha = (0.4 - i * 0.1) * intensity;

          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 220, 255, ${ringAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      timeRef.current++;
      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isSpeaking]);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default CymaticVisualizer;
// FILE: src/components/oracle/GenerativeVisualizer.tsx
// Generative art visualizer — particle-based organic motion
// Sprint E will expand this into full avatar system
// For now: flowing particles that respond to Oracle speaking

import React, { useEffect, useRef } from 'react';
import { useOracleSpeakingState } from '@/hooks/useTts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

const GenerativeVisualizer: React.FC = () => {
  const isSpeaking = useOracleSpeakingState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const intensityRef = useRef(0);

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

    const centerX = () => width / 2;
    const centerY = () => height / 2;

    const spawnParticle = (): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      return {
        x: centerX() + (Math.random() - 0.5) * 40,
        y: centerY() + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 120,
        size: 1 + Math.random() * 3,
        hue: 180 + Math.random() * 40, // Cyan range
      };
    };

    const draw = () => {
      const targetIntensity = isSpeaking ? 1 : 0;
      intensityRef.current += (targetIntensity - intensityRef.current) * 0.03;

      // Slightly transparent clear for trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);

      const particles = particlesRef.current;
      const intensity = intensityRef.current;

      // Spawn new particles when speaking
      if (isSpeaking && particles.length < 150) {
        const spawnCount = Math.floor(3 * intensity);
        for (let i = 0; i < spawnCount; i++) {
          particles.push(spawnParticle());
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Remove dead particles
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        // Organic motion: slight curve toward center with noise
        const dx = centerX() - p.x;
        const dy = centerY() - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gentle gravitational pull back toward center
        if (dist > 50) {
          p.vx += (dx / dist) * 0.02;
          p.vy += (dy / dist) * 0.02;
        }

        // Add noise
        p.vx += (Math.random() - 0.5) * 0.3;
        p.vy += (Math.random() - 0.5) * 0.3;

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Draw
        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.sin(lifeRatio * Math.PI) * intensity * 0.8; // Fade in and out

        if (alpha > 0.01) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${alpha})`;
          ctx.fill();

          // Glow effect
          if (p.size > 2) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.15})`;
            ctx.fill();
          }
        }
      }

      // Draw connecting lines between nearby particles
      if (intensity > 0.3) {
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.08 * intensity})`;
        ctx.lineWidth = 0.5;

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 3600) { // 60px radius
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

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

export default GenerativeVisualizer;
// FILE: src/components/oracle/GenerativeVisualizer.tsx
// Audio-reactive generative particle system visualizer

import React, { useEffect, useRef, useState } from 'react';
import { useTts } from '@/hooks/useTts';
import { cn } from '@/lib/utils';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
}

const GenerativeVisualizer: React.FC = () => {
  const { isSpeaking } = useTts();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio analysis
  useEffect(() => {
    if (!isSpeaking) return;

    const initAudio = async () => {
      try {
        const audioElements = document.getElementsByTagName('audio');
        const audioElement = audioElements[audioElements.length - 1];
        
        if (!audioElement) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 512;
          analyserRef.current.smoothingTimeConstant = 0.7;
          
          const source = audioContextRef.current.createMediaElementSource(audioElement);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize audio analysis:', error);
      }
    };

    initAudio();
  }, [isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isSpeaking || !isInitialized) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const resizeHandler = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 150; i++) {
        particlesRef.current.push(createParticle(width, height));
      }
    };

    const createParticle = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      life: 1,
      maxLife: Math.random() * 100 + 100,
      hue: Math.random() * 60 + 180 // Cyan to blue range
    });

    initParticles();

    const draw = () => {
      // Fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Get audio data
      let audioData: number[] = [];
      let bassLevel = 0;
      let trebleLevel = 0;
      
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Convert to normalized values
        audioData = Array.from(dataArray).map(v => v / 255);
        
        // Calculate bass (low frequencies) and treble (high frequencies)
        const bassEnd = Math.floor(dataArray.length * 0.1);
        const trebleStart = Math.floor(dataArray.length * 0.7);
        
        for (let i = 0; i < bassEnd; i++) {
          bassLevel += audioData[i];
        }
        bassLevel /= bassEnd;
        
        for (let i = trebleStart; i < dataArray.length; i++) {
          trebleLevel += audioData[i];
        }
        trebleLevel /= (dataArray.length - trebleStart);
      }

      // Update and draw particles
      particlesRef.current.forEach((particle, index) => {
        // Audio influence on particle movement
        const audioInfluence = audioData[Math.floor(index % audioData.length)] || 0;
        
        // Update velocity based on audio
        particle.vx += (Math.random() - 0.5) * audioInfluence * 5;
        particle.vy += (Math.random() - 0.5) * audioInfluence * 5;
        
        // Apply some damping
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;
        
        // Update life
        particle.life -= 1 / particle.maxLife;
        if (particle.life <= 0) {
          particlesRef.current[index] = createParticle(width, height);
          return;
        }
        
        // Draw particle
        const size = particle.size * (1 + bassLevel * 3);
        const opacity = particle.life * (0.5 + trebleLevel * 0.5);
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particle.hue + bassLevel * 60}, 70%, 50%, ${opacity})`;
        ctx.fill();
        
        // Add glow effect for louder sounds
        if (audioInfluence > 0.5) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${particle.hue}, 70%, 50%, ${opacity * 0.2})`;
          ctx.fill();
        }
      });

      // Draw connections between nearby particles
      ctx.strokeStyle = `rgba(0, 255, 255, 0.1)`;
      ctx.lineWidth = 1;
      
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const distance = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          
          if (distance < 100 * (1 + bassLevel)) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
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
  }, [isSpeaking, isInitialized]);

  return (
    <div className={cn(
      "fixed inset-0 z-[200] pointer-events-none transition-opacity duration-1000",
      isSpeaking ? "opacity-100" : "opacity-0"
    )}>
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        style={{
          mixBlendMode: 'screen'
        }}
      />
    </div>
  );
};

export default GenerativeVisualizer;
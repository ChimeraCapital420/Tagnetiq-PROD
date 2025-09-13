// FILE: src/components/oracle/CymaticVisualizer.tsx
// Audio-reactive cymatic patterns visualizer

import React, { useEffect, useRef, useState } from 'react';
import { useTts } from '@/hooks/useTts';
import { cn } from '@/lib/utils';

const CymaticVisualizer: React.FC = () => {
  const { isSpeaking } = useTts();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio analysis
  useEffect(() => {
    if (!isSpeaking) return;

    const initAudio = async () => {
      try {
        // Get the audio element from the page (created by useTts)
        const audioElements = document.getElementsByTagName('audio');
        const audioElement = audioElements[audioElements.length - 1];
        
        if (!audioElement) return;

        // Create audio context and analyser
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
          
          // Connect audio source to analyser
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

    // Cymatic pattern parameters
    let time = 0;
    const patterns = [
      { nodes: 3, amplitude: 50, frequency: 0.02 },
      { nodes: 5, amplitude: 40, frequency: 0.03 },
      { nodes: 7, amplitude: 30, frequency: 0.04 },
      { nodes: 9, amplitude: 20, frequency: 0.05 }
    ];

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.15;

      // Get audio data
      let audioLevel = 0;
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const sum = dataArray.reduce((a, b) => a + b, 0);
        audioLevel = sum / dataArray.length / 255;
      }

      // Draw cymatic patterns
      patterns.forEach((pattern, index) => {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${180 + index * 30}, 70%, 50%, ${0.3 + audioLevel * 0.7})`;
        ctx.lineWidth = 2 + audioLevel * 3;
        
        for (let angle = 0; angle <= 360; angle += 1) {
          const radian = angle * (Math.PI / 180);
          
          // Create cymatic pattern formula
          const r1 = Math.sin(pattern.nodes * radian + time * pattern.frequency);
          const r2 = Math.cos((pattern.nodes + 1) * radian - time * pattern.frequency * 0.5);
          const r3 = Math.sin((pattern.nodes - 1) * radian + time * pattern.frequency * 1.5);
          
          const modulation = (r1 + r2 * 0.5 + r3 * 0.3) * pattern.amplitude * (1 + audioLevel * 2);
          const radius = baseRadius + modulation;
          
          const x = centerX + radius * Math.cos(radian);
          const y = centerY + radius * Math.sin(radian);
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.stroke();
      });

      // Add center glow effect
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius);
      gradient.addColorStop(0, `rgba(0, 255, 255, ${audioLevel * 0.5})`);
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      time++;
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

export default CymaticVisualizer;
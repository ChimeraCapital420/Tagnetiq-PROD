// FILE: src/components/investor/AnimatedCounter.tsx

import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) return;

    // Animate over 1.5 seconds
    const duration = 1500;
    const startTime = Date.now();

    const frame = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.floor(progress * end);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
};

export default AnimatedCounter;
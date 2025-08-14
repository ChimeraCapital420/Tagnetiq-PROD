import React from 'react';
import './animations.css';

const OceanBackground: React.FC = () => (
  <div className="ocean-bg">
    <div className="bubbles">
      {[...Array(20)].map((_, i) => <div key={i} className="bubble" style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 10}s`,
      }}></div>)}
    </div>
  </div>
);

export default OceanBackground;
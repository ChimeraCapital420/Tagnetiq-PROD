import React from 'react';
import './animations.css';

export const WinterOverlay: React.FC = () => (
  <div className="particles">
    {[...Array(50)].map((_, i) => <div key={i} className="particle snow"></div>)}
  </div>
);
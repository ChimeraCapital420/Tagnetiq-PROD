import React from 'react';
import './animations.css';

export const FallOverlay: React.FC = () => (
    <div className="particles">
      {[...Array(20)].map((_, i) => <div key={i} className="particle leaf">🍂</div>)}
    </div>
);
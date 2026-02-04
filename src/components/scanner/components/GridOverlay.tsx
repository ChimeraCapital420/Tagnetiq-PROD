// FILE: src/components/scanner/components/GridOverlay.tsx
// Camera composition grid overlay
// Supports rule-of-thirds, golden ratio, center cross, diagonal

import React from 'react';
import type { GridType } from '../types';

interface GridOverlayProps {
  width: number;
  height: number;
  enabled: boolean;
  type: GridType;
  opacity: number;
  color: string;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({
  width,
  height,
  enabled,
  type,
  opacity,
  color,
}) => {
  if (!enabled || width === 0 || height === 0) {
    return null;
  }

  const strokeStyle = { stroke: color, strokeWidth: 1 };
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity,
    zIndex: 10,
  };

  // Golden ratio constant
  const PHI = 1.618033988749;
  const goldenRatio = 1 / PHI;

  return (
    <div style={containerStyle}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {type === 'rule-of-thirds' && (
          <>
            {/* Vertical lines */}
            <line x1={width / 3} y1={0} x2={width / 3} y2={height} {...strokeStyle} />
            <line x1={(width * 2) / 3} y1={0} x2={(width * 2) / 3} y2={height} {...strokeStyle} />
            {/* Horizontal lines */}
            <line x1={0} y1={height / 3} x2={width} y2={height / 3} {...strokeStyle} />
            <line x1={0} y1={(height * 2) / 3} x2={width} y2={(height * 2) / 3} {...strokeStyle} />
            {/* Intersection points */}
            <circle cx={width / 3} cy={height / 3} r={4} fill={color} fillOpacity={0.5} />
            <circle cx={(width * 2) / 3} cy={height / 3} r={4} fill={color} fillOpacity={0.5} />
            <circle cx={width / 3} cy={(height * 2) / 3} r={4} fill={color} fillOpacity={0.5} />
            <circle cx={(width * 2) / 3} cy={(height * 2) / 3} r={4} fill={color} fillOpacity={0.5} />
          </>
        )}

        {type === 'golden-ratio' && (
          <>
            {/* Vertical golden lines */}
            <line x1={width * goldenRatio} y1={0} x2={width * goldenRatio} y2={height} {...strokeStyle} />
            <line x1={width * (1 - goldenRatio)} y1={0} x2={width * (1 - goldenRatio)} y2={height} {...strokeStyle} />
            {/* Horizontal golden lines */}
            <line x1={0} y1={height * goldenRatio} x2={width} y2={height * goldenRatio} {...strokeStyle} />
            <line x1={0} y1={height * (1 - goldenRatio)} x2={width} y2={height * (1 - goldenRatio)} {...strokeStyle} />
            {/* Golden spiral hint (simplified) */}
            <circle 
              cx={width * goldenRatio} 
              cy={height * goldenRatio} 
              r={Math.min(width, height) * 0.02} 
              fill={color} 
              fillOpacity={0.6} 
            />
          </>
        )}

        {type === 'center-cross' && (
          <>
            {/* Center cross */}
            <line x1={width / 2} y1={0} x2={width / 2} y2={height} {...strokeStyle} />
            <line x1={0} y1={height / 2} x2={width} y2={height / 2} {...strokeStyle} />
            {/* Center circle */}
            <circle 
              cx={width / 2} 
              cy={height / 2} 
              r={Math.min(width, height) * 0.05} 
              fill="none" 
              {...strokeStyle} 
            />
            {/* Corner markers */}
            <line x1={0} y1={height * 0.1} x2={width * 0.1} y2={0} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={width} y1={height * 0.1} x2={width * 0.9} y2={0} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={0} y1={height * 0.9} x2={width * 0.1} y2={height} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={width} y1={height * 0.9} x2={width * 0.9} y2={height} {...strokeStyle} strokeOpacity={0.5} />
          </>
        )}

        {type === 'diagonal' && (
          <>
            {/* Diagonal lines */}
            <line x1={0} y1={0} x2={width} y2={height} {...strokeStyle} />
            <line x1={width} y1={0} x2={0} y2={height} {...strokeStyle} />
            {/* Additional guide lines */}
            <line x1={0} y1={height / 2} x2={width / 2} y2={0} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={width / 2} y1={0} x2={width} y2={height / 2} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={0} y1={height / 2} x2={width / 2} y2={height} {...strokeStyle} strokeOpacity={0.5} />
            <line x1={width / 2} y1={height} x2={width} y2={height / 2} {...strokeStyle} strokeOpacity={0.5} />
          </>
        )}
      </svg>
    </div>
  );
};

export default GridOverlay;
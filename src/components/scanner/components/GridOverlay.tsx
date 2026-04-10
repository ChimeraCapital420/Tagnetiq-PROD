// FILE: src/components/scanner/components/GridOverlay.tsx
// Camera composition grid overlay
// Supports rule-of-thirds, golden ratio, center cross, diagonal
//
// v2.0: Normalized viewBox — no width/height props required.
//   Previous version required pixel dimensions which ScannerViewport
//   never passed, causing GridOverlay to return null (guard: width===0).
//   Now uses a 0 0 100 100 normalized coordinate space — all positions
//   expressed as percentages. SVG scales to fill the container.
//   width and height props removed from interface entirely.

import React from 'react';
import type { GridType } from '../types';

interface GridOverlayProps {
  enabled: boolean;
  type: GridType;
  opacity: number;
  color: string;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({
  enabled,
  type,
  opacity,
  color,
}) => {
  if (!enabled) return null;

  // Golden ratio constant
  const PHI = 1.618033988749;
  const gr = (1 / PHI) * 100; // as percentage of 100-unit space

  const s = { stroke: color, strokeWidth: 0.5 };   // thin lines in normalized space
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity,
    zIndex: 20,                                      // above video (0) and barcode UI (10)
  };

  return (
    <div style={containerStyle}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {type === 'rule-of-thirds' && (
          <>
            {/* Vertical thirds */}
            <line x1={100 / 3}      y1={0}   x2={100 / 3}      y2={100} {...s} />
            <line x1={(100 * 2) / 3} y1={0}   x2={(100 * 2) / 3} y2={100} {...s} />
            {/* Horizontal thirds */}
            <line x1={0} y1={100 / 3}       x2={100} y2={100 / 3}       {...s} />
            <line x1={0} y1={(100 * 2) / 3} x2={100} y2={(100 * 2) / 3} {...s} />
            {/* Intersection points */}
            <circle cx={100 / 3}       cy={100 / 3}       r={1.2} fill={color} fillOpacity={0.6} />
            <circle cx={(100 * 2) / 3} cy={100 / 3}       r={1.2} fill={color} fillOpacity={0.6} />
            <circle cx={100 / 3}       cy={(100 * 2) / 3} r={1.2} fill={color} fillOpacity={0.6} />
            <circle cx={(100 * 2) / 3} cy={(100 * 2) / 3} r={1.2} fill={color} fillOpacity={0.6} />
          </>
        )}

        {type === 'golden-ratio' && (
          <>
            {/* Vertical golden lines */}
            <line x1={gr}       y1={0} x2={gr}       y2={100} {...s} />
            <line x1={100 - gr} y1={0} x2={100 - gr} y2={100} {...s} />
            {/* Horizontal golden lines */}
            <line x1={0} y1={gr}       x2={100} y2={gr}       {...s} />
            <line x1={0} y1={100 - gr} x2={100} y2={100 - gr} {...s} />
            {/* Golden spiral hint */}
            <circle cx={gr} cy={gr} r={1.5} fill={color} fillOpacity={0.7} />
          </>
        )}

        {type === 'center-cross' && (
          <>
            {/* Center lines */}
            <line x1={50} y1={0}  x2={50}  y2={100} {...s} />
            <line x1={0}  y1={50} x2={100} y2={50}  {...s} />
            {/* Center circle */}
            <circle cx={50} cy={50} r={5} fill="none" {...s} />
            {/* Corner markers */}
            <line x1={0}   y1={10} x2={10}  y2={0}   {...s} strokeOpacity={0.5} />
            <line x1={100} y1={10} x2={90}  y2={0}   {...s} strokeOpacity={0.5} />
            <line x1={0}   y1={90} x2={10}  y2={100} {...s} strokeOpacity={0.5} />
            <line x1={100} y1={90} x2={90}  y2={100} {...s} strokeOpacity={0.5} />
          </>
        )}

        {type === 'diagonal' && (
          <>
            {/* Main diagonals */}
            <line x1={0}   y1={0}  x2={100} y2={100} {...s} />
            <line x1={100} y1={0}  x2={0}   y2={100} {...s} />
            {/* Sub-diagonals */}
            <line x1={0}  y1={50} x2={50}  y2={0}   {...s} strokeOpacity={0.5} />
            <line x1={50} y1={0}  x2={100} y2={50}  {...s} strokeOpacity={0.5} />
            <line x1={0}  y1={50} x2={50}  y2={100} {...s} strokeOpacity={0.5} />
            <line x1={50} y1={100} x2={100} y2={50} {...s} strokeOpacity={0.5} />
          </>
        )}
      </svg>
    </div>
  );
};

export default GridOverlay;
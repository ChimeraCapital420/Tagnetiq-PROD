// FILE: src/components/GridOverlay.tsx
// Renders composition grid overlay on camera feed
// Mobile-first: GPU-accelerated, touch-through, responsive

import React, { useMemo, memo } from 'react';
import { useGridOverlay, type GridType } from '@/hooks/useGridOverlay';

// =============================================================================
// TYPES
// =============================================================================

interface GridOverlayProps {
  width: number;
  height: number;
  className?: string;
}

interface GridOverlayWithHookProps {
  width: number;
  height: number;
  className?: string;
  // Optional: use external settings instead of hook
  enabled?: boolean;
  type?: GridType;
  opacity?: number;
  color?: string;
}

// =============================================================================
// SVG GENERATORS (Pure functions for memoization)
// =============================================================================

function generateRuleOfThirds(
  width: number,
  height: number,
  color: string,
  opacity: number
): React.ReactNode {
  const strokeOpacity = opacity / 100;
  const third1X = width / 3;
  const third2X = (width * 2) / 3;
  const third1Y = height / 3;
  const third2Y = (height * 2) / 3;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Vertical lines */}
      <line
        x1={third1X}
        y1={0}
        x2={third1X}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      <line
        x1={third2X}
        y1={0}
        x2={third2X}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {/* Horizontal lines */}
      <line
        x1={0}
        y1={third1Y}
        x2={width}
        y2={third1Y}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      <line
        x1={0}
        y1={third2Y}
        x2={width}
        y2={third2Y}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {/* Power points (intersections) */}
      <circle
        cx={third1X}
        cy={third1Y}
        r={4}
        fill={color}
        fillOpacity={strokeOpacity * 0.6}
      />
      <circle
        cx={third2X}
        cy={third1Y}
        r={4}
        fill={color}
        fillOpacity={strokeOpacity * 0.6}
      />
      <circle
        cx={third1X}
        cy={third2Y}
        r={4}
        fill={color}
        fillOpacity={strokeOpacity * 0.6}
      />
      <circle
        cx={third2X}
        cy={third2Y}
        r={4}
        fill={color}
        fillOpacity={strokeOpacity * 0.6}
      />
    </svg>
  );
}

function generateGoldenRatio(
  width: number,
  height: number,
  color: string,
  opacity: number
): React.ReactNode {
  const strokeOpacity = opacity / 100;
  const phi = 1.618;
  const goldenX1 = width / phi;
  const goldenX2 = width - width / phi;
  const goldenY1 = height / phi;
  const goldenY2 = height - height / phi;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Vertical lines */}
      <line
        x1={goldenX1}
        y1={0}
        x2={goldenX1}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      <line
        x1={goldenX2}
        y1={0}
        x2={goldenX2}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {/* Horizontal lines */}
      <line
        x1={0}
        y1={goldenY1}
        x2={width}
        y2={goldenY1}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      <line
        x1={0}
        y1={goldenY2}
        x2={width}
        y2={goldenY2}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {/* Golden point indicator */}
      <circle
        cx={goldenX2}
        cy={goldenY1}
        r={6}
        fill="none"
        stroke={color}
        strokeOpacity={strokeOpacity * 0.8}
        strokeWidth={1.5}
      />
    </svg>
  );
}

function generateCenterCross(
  width: number,
  height: number,
  color: string,
  opacity: number
): React.ReactNode {
  const strokeOpacity = opacity / 100;
  const centerX = width / 2;
  const centerY = height / 2;
  const crossSize = Math.min(width, height) * 0.08;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Dashed center lines */}
      <line
        x1={centerX}
        y1={0}
        x2={centerX}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.3}
        strokeWidth={1}
        strokeDasharray="8,8"
      />
      <line
        x1={0}
        y1={centerY}
        x2={width}
        y2={centerY}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.3}
        strokeWidth={1}
        strokeDasharray="8,8"
      />
      {/* Center crosshair */}
      <line
        x1={centerX - crossSize}
        y1={centerY}
        x2={centerX + crossSize}
        y2={centerY}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={2}
      />
      <line
        x1={centerX}
        y1={centerY - crossSize}
        x2={centerX}
        y2={centerY + crossSize}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={2}
      />
      {/* Center circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r={crossSize * 0.6}
        fill="none"
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
    </svg>
  );
}

function generateDiagonal(
  width: number,
  height: number,
  color: string,
  opacity: number
): React.ReactNode {
  const strokeOpacity = opacity / 100;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Main diagonals */}
      <line
        x1={0}
        y1={0}
        x2={width}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      <line
        x1={width}
        y1={0}
        x2={0}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {/* Edge to center diagonals */}
      <line
        x1={0}
        y1={height / 2}
        x2={width / 2}
        y2={0}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
      <line
        x1={width / 2}
        y1={0}
        x2={width}
        y2={height / 2}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
      <line
        x1={width}
        y1={height / 2}
        x2={width / 2}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
      <line
        x1={width / 2}
        y1={height}
        x2={0}
        y2={height / 2}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
    </svg>
  );
}

function generateSquareGrid(
  width: number,
  height: number,
  color: string,
  opacity: number
): React.ReactNode {
  const strokeOpacity = opacity / 100;
  const gridSize = Math.min(width, height) / 6;
  const lines: React.ReactNode[] = [];

  // Vertical lines
  for (let x = gridSize; x < width; x += gridSize) {
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
    );
  }

  // Horizontal lines
  for (let y = gridSize; y < height; y += gridSize) {
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={color}
        strokeOpacity={strokeOpacity * 0.5}
        strokeWidth={1}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {lines}
    </svg>
  );
}

// =============================================================================
// GRID OVERLAY COMPONENT (Standalone - uses props)
// =============================================================================

export const GridOverlay = memo<GridOverlayWithHookProps>(function GridOverlay({
  width,
  height,
  className = '',
  enabled = false,
  type = 'rule-of-thirds',
  opacity = 50,
  color = '#ffffff',
}) {
  const gridContent = useMemo(() => {
    if (!enabled || type === 'none' || width === 0 || height === 0) {
      return null;
    }

    switch (type) {
      case 'rule-of-thirds':
        return generateRuleOfThirds(width, height, color, opacity);
      case 'golden-ratio':
        return generateGoldenRatio(width, height, color, opacity);
      case 'center-cross':
        return generateCenterCross(width, height, color, opacity);
      case 'diagonal':
        return generateDiagonal(width, height, color, opacity);
      default:
        return null;
    }
  }, [enabled, type, width, height, color, opacity]);

  if (!gridContent) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      style={{ willChange: 'transform' }} // GPU acceleration hint
      aria-hidden="true"
    >
      {gridContent}
    </div>
  );
});

// =============================================================================
// GRID OVERLAY WITH HOOK (Uses useGridOverlay internally)
// =============================================================================

export const GridOverlayWithHook = memo<GridOverlayProps>(function GridOverlayWithHook({
  width,
  height,
  className = '',
}) {
  const { settings } = useGridOverlay();

  return (
    <GridOverlay
      width={width}
      height={height}
      className={className}
      enabled={settings.enabled}
      type={settings.type}
      opacity={settings.opacity}
      color={settings.color}
    />
  );
});

// =============================================================================
// QUICK TOGGLE BUTTON (For adding to camera UI)
// =============================================================================

interface GridToggleButtonProps {
  className?: string;
}

export const GridToggleButton = memo<GridToggleButtonProps>(function GridToggleButton({
  className = '',
}) {
  const { settings, toggle, cycleType } = useGridOverlay();

  return (
    <button
      onClick={toggle}
      onDoubleClick={cycleType}
      className={`p-2 rounded-full transition-colors ${
        settings.enabled
          ? 'bg-white/30 text-white'
          : 'bg-black/30 text-white/70'
      } ${className}`}
      title={`Grid: ${settings.enabled ? settings.type : 'Off'} (double-tap to change type)`}
      aria-label={`Toggle grid overlay (currently ${settings.enabled ? 'on' : 'off'})`}
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        {/* 3x3 grid icon */}
        <line x1="8" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="16" y2="21" />
        <line x1="3" y1="8" x2="21" y2="8" />
        <line x1="3" y1="16" x2="21" y2="16" />
      </svg>
    </button>
  );
});

export default GridOverlay;
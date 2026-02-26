// FILE: src/components/GlassesStatusIcon.tsx
// Shared glasses status icon with color-coded lenses
// Used in: ResponsiveNavigation (top nav bar), ScannerHeader (scanner toolbar)
//
// Status → Lens Color → Tap Action:
//   gray   → SDK unavailable (browser)     → open SmartGlassesShopSheet
//   red    → not registered with Meta AI   → trigger registration flow
//   yellow → registered but disconnected   → toast "put on your glasses"
//   green  → connected & ready             → navigate to Hunt Mode
//
// Mobile-first: 44px touch targets, haptic-ready

import React from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type GlassesStatus = 'unavailable' | 'unregistered' | 'disconnected' | 'connected';

export interface MetaGlassesState {
  pluginAvailable: boolean;
  isRegistered: boolean;
  isConnected: boolean;
  isSessionActive: boolean;
  cameraPermissionGranted: boolean;
  batteryLevel: number | null;
  deviceName: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface GlassesStatusIconProps {
  /** Current meta glasses state from useBluetoothManager */
  metaGlasses: MetaGlassesState;
  /** Called when user taps red icon (needs registration) */
  onRegister?: () => void;
  /** Called when user taps green icon (ready for Hunt Mode) */
  onHuntMode?: () => void;
  /** Called when user taps gray icon (no SDK — show shop sheet) */
  onShopGlasses?: () => void;
  /** Visual variant — nav bar is smaller, scanner toolbar is larger */
  variant?: 'nav' | 'scanner';
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// STATUS DERIVATION
// =============================================================================

export function deriveGlassesStatus(state: MetaGlassesState): GlassesStatus {
  if (!state.pluginAvailable) return 'unavailable';
  if (!state.isRegistered) return 'unregistered';
  if (!state.isConnected) return 'disconnected';
  return 'connected';
}

const STATUS_CONFIG: Record<GlassesStatus, {
  lensColor: string;
  label: string;
  pulseClass: string;
}> = {
  unavailable: {
    lensColor: '#6B7280', // gray-500
    label: 'Get smart glasses for TagnetIQ',
    pulseClass: '',
  },
  unregistered: {
    lensColor: '#EF4444', // red-500
    label: 'Tap to register glasses',
    pulseClass: 'animate-pulse',
  },
  disconnected: {
    lensColor: '#EAB308', // yellow-500
    label: 'Glasses disconnected',
    pulseClass: '',
  },
  connected: {
    lensColor: '#22C55E', // green-500
    label: 'Glasses ready — tap for Hunt Mode',
    pulseClass: '',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

const GlassesStatusIcon: React.FC<GlassesStatusIconProps> = ({
  metaGlasses,
  onRegister,
  onHuntMode,
  onShopGlasses,
  variant = 'nav',
  className = '',
}) => {
  const status = deriveGlassesStatus(metaGlasses);
  const config = STATUS_CONFIG[status];

  const handleTap = () => {
    switch (status) {
      case 'unavailable':
        if (onShopGlasses) {
          onShopGlasses();
        } else {
          toast.info('Smart glasses enhance your TagnetIQ experience', {
            description: 'Download the mobile app to get started',
          });
        }
        break;
      case 'unregistered':
        if (onRegister) {
          onRegister();
        } else {
          toast.info('Register your Meta glasses to get started');
        }
        break;
      case 'disconnected':
        toast.info('Put on your glasses', {
          description: 'Make sure they\'re charged and Meta AI app is connected',
        });
        break;
      case 'connected':
        if (onHuntMode) {
          onHuntMode();
        } else {
          toast.success('Glasses connected!');
        }
        break;
    }
  };

  // Size based on variant
  const isScanner = variant === 'scanner';
  const svgSize = isScanner ? 'w-5 h-5' : 'w-4 h-4';
  const btnSize = isScanner
    ? 'w-10 h-10'       // 40px — scanner toolbar standard
    : 'h-8 px-2 sm:px-3'; // nav bar standard

  const btnBase = isScanner
    ? 'inline-flex items-center justify-center rounded-md text-white touch-manipulation'
    : 'inline-flex items-center justify-center rounded-md touch-manipulation text-sm font-medium';

  // Scanner variant: match ghost/grid button styling for active state
  const scannerActive = isScanner && status === 'connected'
    ? 'bg-green-600/40 ring-2 ring-green-400'
    : '';

  return (
    <button
      onClick={handleTap}
      className={`relative ${btnBase} ${btnSize} ${scannerActive} ${config.pulseClass} ${className}`}
      title={config.label}
      aria-label={config.label}
      data-tour="glasses-status"
    >
      {/* Loading spinner overlay */}
      {metaGlasses.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Glasses SVG — lenses filled with status color */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={`${svgSize} ${metaGlasses.isLoading ? 'opacity-30' : ''}`}
        aria-hidden="true"
      >
        {/* Left lens */}
        <rect
          x="1.5" y="9" width="8" height="6" rx="3" ry="3"
          fill={config.lensColor}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity={status === 'unavailable' ? 0.4 : 0.9}
        />
        {/* Right lens */}
        <rect
          x="14.5" y="9" width="8" height="6" rx="3" ry="3"
          fill={config.lensColor}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity={status === 'unavailable' ? 0.4 : 0.9}
        />
        {/* Bridge */}
        <path
          d="M9.5 11 C10.5 9.5, 13.5 9.5, 14.5 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Left temple arm */}
        <line
          x1="1.5" y1="10" x2="0.5" y2="7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Right temple arm */}
        <line
          x1="22.5" y1="10" x2="23.5" y2="7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Label — nav variant only, hidden on small screens */}
      {!isScanner && (
        <span className="hidden sm:inline-block ml-1 text-xs">
          {status === 'connected' ? 'Hunt' : ''}
        </span>
      )}
    </button>
  );
};

export default GlassesStatusIcon;
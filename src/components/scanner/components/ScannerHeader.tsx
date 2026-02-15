// FILE: src/components/scanner/components/ScannerHeader.tsx
// Extracted from DualScanner.tsx — top toolbar
// Mobile-first: Touch-friendly 44px targets, haptic feedback

import React from 'react';
import {
  X,
  FlipHorizontal,
  Settings as SettingsIcon,
  Bluetooth,
  Flashlight,
  Grid3X3,
  Ghost,
  Focus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// TYPES
// =============================================================================

export interface ScannerHeaderProps {
  /** Close the scanner */
  onClose: () => void;
  /** Toggle ghost mode sheet */
  onGhostToggle: () => void;
  /** Open settings modal */
  onSettingsOpen: () => void;
  /** Open device pairing modal */
  onBluetoothOpen: () => void;
  /** Toggle grid overlay */
  onGridToggle: () => void;
  /** Toggle torch/flashlight */
  onTorchToggle: () => void;
  /** Switch front/back camera */
  onFlipCamera: () => void;
  /** Trigger focus */
  onFocus: () => void;
  /** Ghost mode state */
  isGhostMode: boolean;
  /** Grid overlay enabled */
  isGridEnabled: boolean;
  /** Torch/flash enabled */
  isTorchOn: boolean;
  /** Camera supports torch */
  hasTorch: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ScannerHeader: React.FC<ScannerHeaderProps> = ({
  onClose,
  onGhostToggle,
  onSettingsOpen,
  onBluetoothOpen,
  onGridToggle,
  onTorchToggle,
  onFlipCamera,
  onFocus,
  isGhostMode,
  isGridEnabled,
  isTorchOn,
  hasTorch,
}) => {
  return (
    <div className="dual-scanner-header flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-sm z-20">
      {/* Left: Ghost + Settings */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onGhostToggle}
          className={`text-white touch-manipulation w-10 h-10 ${
            isGhostMode ? 'bg-purple-600/60 ring-2 ring-purple-400' : ''
          }`}
          title="Ghost Protocol"
        >
          <Ghost className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsOpen}
          className="text-white touch-manipulation w-10 h-10"
          title="Camera Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onBluetoothOpen}
          className="text-white touch-manipulation w-10 h-10"
          title="Pair Device"
        >
          <Bluetooth className="w-5 h-5" />
        </Button>
      </div>

      {/* Center: Grid + Torch + Focus */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onGridToggle}
          className={`text-white touch-manipulation w-10 h-10 ${
            isGridEnabled ? 'bg-white/20' : ''
          }`}
          title="Grid Overlay"
        >
          <Grid3X3 className="w-5 h-5" />
        </Button>

        {hasTorch && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTorchToggle}
            className={`text-white touch-manipulation w-10 h-10 ${
              isTorchOn ? 'bg-yellow-500/40' : ''
            }`}
            title="Flashlight"
          >
            <Flashlight className="w-5 h-5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onFocus}
          className="text-white touch-manipulation w-10 h-10"
          title="Focus"
        >
          <Focus className="w-5 h-5" />
        </Button>
      </div>

      {/* Right: Flip + Close */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onFlipCamera}
          className="text-white touch-manipulation w-10 h-10"
          title="Flip Camera"
        >
          <FlipHorizontal className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white touch-manipulation w-10 h-10"
          title="Close Scanner"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default ScannerHeader;
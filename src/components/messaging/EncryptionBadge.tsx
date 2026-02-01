// FILE: src/components/messaging/EncryptionBadge.tsx
// Display encryption status with details on hover/click

import { useState } from 'react';
import { Shield, ShieldCheck, Lock, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EncryptionBadgeProps {
  variant?: 'minimal' | 'compact' | 'detailed' | 'banner';
  isEncrypted?: boolean;
  className?: string;
}

const ENCRYPTION_SPECS = {
  level: 'Military-Grade',
  rating: 'AES-256',
  algorithms: [
    { name: 'AES-256-GCM', purpose: 'Message encryption', strength: '256-bit' },
    { name: 'RSA-2048-OAEP', purpose: 'Key exchange', strength: '2048-bit' },
    { name: 'SHA-256', purpose: 'Integrity verification', strength: '256-bit' },
  ],
  certifications: [
    'NSA Suite B approved',
    'FIPS 140-2 compliant',
    'NIST recommended',
  ],
  usedBy: ['Signal', 'WhatsApp', 'US Government', 'Banks worldwide'],
};

export function EncryptionBadge({ 
  variant = 'compact', 
  isEncrypted = true,
  className 
}: EncryptionBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isEncrypted) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-yellow-500 text-xs",
        className
      )}>
        <Shield className="w-3.5 h-3.5" />
        <span>Not encrypted</span>
      </div>
    );
  }

  // Minimal: Just an icon
  if (variant === 'minimal') {
    return (
      <div 
        className={cn("relative group", className)}
        title="End-to-end encrypted with AES-256"
      >
        <ShieldCheck className="w-4 h-4 text-green-500" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          🔒 AES-256 Encrypted
        </div>
      </div>
    );
  }

  // Compact: Icon + short text
  if (variant === 'compact') {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          "flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors",
          className
        )}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span className="font-medium">E2E Encrypted</span>
        {showDetails ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        
        {showDetails && (
          <div 
            className="absolute top-full left-0 mt-2 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[280px]"
            onClick={(e) => e.stopPropagation()}
          >
            <EncryptionDetails />
          </div>
        )}
      </button>
    );
  }

  // Detailed: Full inline display
  if (variant === 'detailed') {
    return (
      <div className={cn(
        "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4",
        className
      )}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-green-500/20 rounded-full">
            <ShieldCheck className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h4 className="font-semibold text-green-500">End-to-End Encrypted</h4>
            <p className="text-xs text-gray-400">Military-grade AES-256 encryption</p>
          </div>
        </div>
        <EncryptionDetails />
      </div>
    );
  }

  // Banner: For chat headers
  if (variant === 'banner') {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-green-500/5 via-emerald-500/10 to-green-500/5 border-y border-green-500/20",
        className
      )}>
        <Lock className="w-3.5 h-3.5 text-green-500" />
        <span className="text-xs text-green-500 font-medium">
          Messages are end-to-end encrypted with AES-256
        </span>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-green-500 hover:text-green-400"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        
        {showDetails && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[320px]">
            <EncryptionDetails showUsedBy />
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Detailed breakdown component
function EncryptionDetails({ showUsedBy = false }: { showUsedBy?: boolean }) {
  return (
    <div className="space-y-3 text-left">
      {/* Algorithms */}
      <div>
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Encryption Stack
        </h5>
        <div className="space-y-1.5">
          {ENCRYPTION_SPECS.algorithms.map((algo) => (
            <div 
              key={algo.name}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-gray-300 font-mono">{algo.name}</span>
              </div>
              <span className="text-gray-500">{algo.strength}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div>
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Compliance
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {ENCRYPTION_SPECS.certifications.map((cert) => (
            <span 
              key={cert}
              className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full"
            >
              {cert}
            </span>
          ))}
        </div>
      </div>

      {/* Used By */}
      {showUsedBy && (
        <div>
          <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Same encryption used by
          </h5>
          <p className="text-xs text-gray-400">
            {ENCRYPTION_SPECS.usedBy.join(' • ')}
          </p>
        </div>
      )}

      {/* Privacy note */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500 leading-relaxed">
          🔐 Your private key never leaves this device. Not even TagnetIQ can read your messages.
        </p>
      </div>
    </div>
  );
}

// Animated shield for loading/initializing states
export function EncryptionInitializing() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <div className="relative">
        <Shield className="w-4 h-4 text-gray-500" />
        <div className="absolute inset-0 animate-ping">
          <Shield className="w-4 h-4 text-green-500 opacity-50" />
        </div>
      </div>
      <span>Initializing encryption...</span>
    </div>
  );
}

// For marketing/landing pages
export function EncryptionFeatureCard() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
      
      <div className="relative">
        {/* Icon */}
        <div className="inline-flex p-3 bg-green-500/20 rounded-xl mb-4">
          <ShieldCheck className="w-8 h-8 text-green-500" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2">
          Military-Grade Encryption
        </h3>
        
        {/* Subtitle */}
        <p className="text-gray-400 mb-4">
          Every message is protected with the same AES-256 encryption trusted by governments and banks worldwide.
        </p>

        {/* Specs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-500">256</div>
            <div className="text-xs text-gray-500">bit AES</div>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-500">2048</div>
            <div className="text-xs text-gray-500">bit RSA</div>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-500">E2E</div>
            <div className="text-xs text-gray-500">encrypted</div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Lock className="w-3.5 h-3.5" />
          <span>Same security as Signal & WhatsApp</span>
        </div>
      </div>
    </div>
  );
}
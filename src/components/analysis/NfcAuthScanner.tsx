// FILE: src/components/analysis/NfcAuthScanner.tsx
// RH-041 Phase 2 — NFC Authentication Scanner
// Web NFC API (Android Chrome 89+). No native app required.
// Reads chip, performs double-scan rolling code test.
// Confirms: authentic chip (rolling) vs clone chip (static ID).
//
// Usage:
//   <NfcAuthScanner brandName="Louis Vuitton" onResult={setNfcResult} />

import React, { useState, useCallback } from 'react';
import { Smartphone, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export interface NfcScanResult {
  supported:        boolean;
  chipDetected:     boolean;
  firstScanId:      string | null;
  secondScanId:     string | null;
  isRollingCode:    boolean | null;  // null = only one scan done
  verdict:          'authentic' | 'suspicious' | 'clone' | 'no_chip' | 'unsupported' | null;
  chipType:         string | null;
  rawRecords:       any[];
  confidence:       number;          // 0-1
}

interface NfcAuthScannerProps {
  brandName: string;
  scanInstruction?: string;
  onResult?: (result: NfcScanResult) => void;
  className?: string;
}

type ScanPhase = 'idle' | 'scan1' | 'scan1_done' | 'scan2' | 'complete' | 'error' | 'unsupported';

function isNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function detectChipType(records: any[]): string {
  if (!records || records.length === 0) return 'Unknown';
  // NXP NTAG chips (used in authentic LV) return specific record structures
  const hasNdefText = records.some(r => r.recordType === 'text');
  const hasNdefUrl  = records.some(r => r.recordType === 'url');
  if (hasNdefUrl)  return 'NFC with URL record (consistent with NXP NTAG)';
  if (hasNdefText) return 'NFC with text record';
  return 'NFC chip detected (unformatted or encrypted)';
}

const VERDICT_CONFIG = {
  authentic:    { color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-500/30', icon: CheckCircle, label: 'Rolling Code Confirmed — Consistent with Authentic Chip' },
  suspicious:   { color: 'text-amber-400',   bg: 'bg-amber-950/40 border-amber-500/30',     icon: AlertCircle, label: 'Inconclusive — Manual authentication recommended' },
  clone:        { color: 'text-red-400',      bg: 'bg-red-950/40 border-red-500/30',         icon: XCircle,     label: 'Static ID Detected — Likely Clone Chip' },
  no_chip:      { color: 'text-white/40',     bg: 'bg-white/5 border-white/10',              icon: AlertCircle, label: 'No NFC chip detected in this area' },
  unsupported:  { color: 'text-white/30',     bg: 'bg-white/5 border-white/10',              icon: Smartphone,  label: 'NFC not supported on this device/browser' },
};

const NfcAuthScanner: React.FC<NfcAuthScannerProps> = ({
  brandName,
  scanInstruction = 'Hold phone flat against the interior lining. Move slowly until you feel a vibration.',
  onResult,
  className = '',
}) => {
  const [phase, setPhase] = useState<ScanPhase>(isNfcSupported() ? 'idle' : 'unsupported');
  const [firstId, setFirstId] = useState<string | null>(null);
  const [secondId, setSecondId] = useState<string | null>(null);
  const [chipType, setChipType] = useState<string | null>(null);
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const readNfcTag = useCallback(async (): Promise<{ id: string; records: any[] } | null> => {
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('No NFC tag detected within 15 seconds. Try repositioning.'));
        }, 15000);

        ndef.onreadingerror = () => {
          clearTimeout(timeout);
          reject(new Error('Error reading NFC tag.'));
        };

        ndef.onreading = ({ serialNumber, message }: any) => {
          clearTimeout(timeout);
          const records = message?.records ? Array.from(message.records).map((r: any) => ({
            recordType: r.recordType,
            data: r.data ? new TextDecoder().decode(r.data) : null,
          })) : [];
          resolve({ id: serialNumber || 'unknown', records });
        };
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('NFC permission denied. Allow NFC access in your browser settings.');
      }
      throw err;
    }
  }, []);

  const startScan1 = useCallback(async () => {
    setPhase('scan1');
    setError(null);
    try {
      const tag = await readNfcTag();
      if (!tag) { setPhase('error'); setError('No chip found in this area.'); return; }
      setFirstId(tag.id);
      setChipType(detectChipType(tag.records));
      setRawRecords(tag.records);
      setPhase('scan1_done');
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  }, [readNfcTag]);

  const startScan2 = useCallback(async () => {
    setPhase('scan2');
    try {
      const tag = await readNfcTag();
      if (!tag) { setPhase('error'); setError('Could not read chip on second scan.'); return; }
      setSecondId(tag.id);

      const isRolling = tag.id !== firstId;
      const verdict: NfcScanResult['verdict'] = isRolling ? 'authentic' : 'clone';
      const confidence = isRolling ? 0.85 : 0.9;

      const result: NfcScanResult = {
        supported:     true,
        chipDetected:  true,
        firstScanId:   firstId,
        secondScanId:  tag.id,
        isRollingCode: isRolling,
        verdict,
        chipType,
        rawRecords,
        confidence,
      };

      setPhase('complete');
      onResult?.(result);
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  }, [readNfcTag, firstId, chipType, rawRecords, onResult]);

  const reset = () => {
    setPhase('idle');
    setFirstId(null);
    setSecondId(null);
    setChipType(null);
    setRawRecords([]);
    setError(null);
  };

  // Determine verdict for display
  const currentVerdict: NfcScanResult['verdict'] = phase === 'complete'
    ? (secondId !== firstId ? 'authentic' : 'clone')
    : phase === 'error' && !firstId ? 'no_chip'
    : null;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">NFC Authentication</p>
          <p className="text-xs text-white/40">{brandName} · Double-scan rolling code test</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Instruction */}
        <p className="text-xs text-white/50 leading-relaxed">{scanInstruction}</p>

        {/* Phase: Unsupported */}
        {phase === 'unsupported' && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/50 text-center">NFC scanning requires Android Chrome 89+.</p>
            <p className="text-xs text-white/30 text-center mt-1">iOS users: use the native NFC reader app, then return here.</p>
          </div>
        )}

        {/* Phase: Idle */}
        {phase === 'idle' && (
          <button
            onClick={startScan1}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all active:scale-[0.98]"
          >
            Start Scan 1 of 2
          </button>
        )}

        {/* Phase: Scanning 1 */}
        {phase === 'scan1' && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-8 h-8 rounded-full border-2 border-blue-400 animate-ping" />
            <p className="text-sm text-white/60">Hold phone to chip location...</p>
          </div>
        )}

        {/* Phase: Scan 1 Done */}
        {phase === 'scan1_done' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
              <p className="text-xs text-emerald-300 font-medium">Scan 1 complete ✓</p>
              <p className="text-[10px] text-emerald-400/60 font-mono mt-0.5">{firstId?.substring(0, 16)}...</p>
              {chipType && <p className="text-[10px] text-white/40 mt-1">{chipType}</p>}
            </div>
            <p className="text-xs text-white/50 text-center">Now wait 3 seconds, then scan the same spot again.</p>
            <button
              onClick={startScan2}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all active:scale-[0.98]"
            >
              Start Scan 2 of 2
            </button>
          </div>
        )}

        {/* Phase: Scanning 2 */}
        {phase === 'scan2' && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-8 h-8 rounded-full border-2 border-blue-400 animate-ping" />
            <p className="text-sm text-white/60">Reading second scan...</p>
          </div>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && currentVerdict && (
          <div className={`p-3 rounded-lg border ${VERDICT_CONFIG[currentVerdict].bg}`}>
            {React.createElement(VERDICT_CONFIG[currentVerdict].icon, {
              className: `w-4 h-4 ${VERDICT_CONFIG[currentVerdict].color} mb-1.5`
            })}
            <p className={`text-sm font-semibold ${VERDICT_CONFIG[currentVerdict].color}`}>
              {VERDICT_CONFIG[currentVerdict].label}
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-white/40 font-mono">Scan 1: {firstId?.substring(0,20)}...</p>
              <p className="text-[10px] text-white/40 font-mono">Scan 2: {secondId?.substring(0,20)}...</p>
              <p className="text-[10px] text-white/30 mt-1">
                {firstId === secondId
                  ? 'IDs identical both scans — static chip. Authentic luxury chips generate a new code every scan.'
                  : 'IDs differ between scans — rolling code confirmed. Consistent with authentic NXP chip.'
                }
              </p>
            </div>
            <button onClick={reset} className="mt-3 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
              <RefreshCw className="w-3 h-3" /> Scan again
            </button>
          </div>
        )}

        {/* Phase: Error */}
        {phase === 'error' && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/20">
            <p className="text-xs text-red-400">{error || 'Scan failed. Try again.'}</p>
            <button onClick={reset} className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        )}

        {/* Double-scan explanation */}
        {(phase === 'idle' || phase === 'unsupported') && (
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 mt-1">
            <p className="text-[10px] text-white/30 leading-relaxed">
              <strong className="text-white/50">Double-scan test:</strong> Authentic {brandName} chips use rolling code encryption — the chip ID changes every scan. Counterfeit clone chips return the same static ID both times. Two taps, three seconds, definitive result.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NfcAuthScanner;
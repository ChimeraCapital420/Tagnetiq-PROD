// FILE: plugins/meta-glasses/src/web.ts
// Browser fallback — all methods gracefully report "not available."
import { WebPlugin } from '@capacitor/core';
import type { MetaGlassesPlugin, MetaGlassesStatus, CapturedFrame } from './definitions';

export class MetaGlassesWeb extends WebPlugin implements MetaGlassesPlugin {
  async isAvailable(): Promise<{ available: boolean }> { return { available: false }; }
  async getStatus(): Promise<MetaGlassesStatus> {
    return { sdkAvailable: false, isRegistered: false, cameraPermissionGranted: false,
             isConnected: false, isSessionActive: false, deviceName: null, batteryLevel: null };
  }
  async register(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Smart glasses require the TagnetIQ mobile app.' };
  }
  async requestCameraPermission(): Promise<{ granted: boolean; error?: string }> {
    return { granted: false, error: 'Not available in browser.' };
  }
  async startSession(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Not available in browser.' };
  }
  async stopSession(): Promise<void> {}
  async captureFrame(): Promise<CapturedFrame> { throw new Error('Not available in browser.'); }
  async getBatteryLevel(): Promise<{ level: number | null }> { return { level: null }; }
}
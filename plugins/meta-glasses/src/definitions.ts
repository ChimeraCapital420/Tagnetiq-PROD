// FILE: plugins/meta-glasses/src/definitions.ts
// TypeScript interface for the Meta Glasses Capacitor plugin.
// This is what your web code imports and calls.
// The actual implementation is in Swift (iOS) and Kotlin (Android).

export interface MetaGlassesPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  getStatus(): Promise<MetaGlassesStatus>;
  register(): Promise<{ success: boolean; error?: string }>;
  requestCameraPermission(): Promise<{ granted: boolean; error?: string }>;
  startSession(options?: SessionOptions): Promise<{ success: boolean; error?: string }>;
  stopSession(): Promise<void>;
  captureFrame(options?: CaptureOptions): Promise<CapturedFrame>;
  getBatteryLevel(): Promise<{ level: number | null }>;

  addListener(
    eventName: 'onFrameAvailable',
    callback: (frame: CapturedFrame) => void,
  ): Promise<{ remove: () => void }>;

  addListener(
    eventName: 'onConnectionChanged',
    callback: (status: { connected: boolean; deviceName: string | null }) => void,
  ): Promise<{ remove: () => void }>;

  addListener(
    eventName: 'onError',
    callback: (error: { code: string; message: string }) => void,
  ): Promise<{ remove: () => void }>;

  removeAllListeners(eventName?: string): Promise<void>;
}

export interface MetaGlassesStatus {
  sdkAvailable: boolean;
  isRegistered: boolean;
  cameraPermissionGranted: boolean;
  isConnected: boolean;
  isSessionActive: boolean;
  deviceName: string | null;
  batteryLevel: number | null;
}

export interface SessionOptions {
  resolution?: '720p' | '504x896' | '360x640';
  frameRate?: 3 | 5 | 15 | 24 | 30;
  sampleRate?: number;
}

export interface CaptureOptions {
  quality?: number;
  maxWidth?: number;
}

export interface CapturedFrame {
  base64: string;
  width: number;
  height: number;
  timestamp: number;
  byteSize: number;
}
// FILE: capacitor.config.ts (project root, next to package.json)
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.tagnetiq.app',
  appName: 'TagnetIQ',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0A0A0F',
  },
  android: {
    backgroundColor: '#0A0A0F',
    // MetaGlassesPlugin is embedded in :app module directly,
    // NOT as a separate Capacitor plugin module.
    includePlugins: [
      '@capacitor/app',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/status-bar'
    ],
  },
  plugins: {},
};
export default config;

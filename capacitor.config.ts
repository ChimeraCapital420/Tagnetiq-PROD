// FILE: capacitor.config.ts (project root, next to package.json)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tagnetiq.app',
  appName: 'TagnetIQ',
  webDir: 'dist',

  server: {
    // Uncomment for dev with live reload:
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
    androidScheme: 'https',
  },

  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0A0A0F',
  },

  android: {
    backgroundColor: '#0A0A0F',
  },

  plugins: {},
};

export default config;
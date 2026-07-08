import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cc.jcikl.connect',
  appName: 'JCI Kuala Lumpur',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#130f2d',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;

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
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
  android: {
    // 调试用：允许 Chrome chrome://inspect 检查 WebView；正式发布前建议改回 false
    webContentsDebuggingEnabled: true,
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;

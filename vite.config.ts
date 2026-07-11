import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'firebase-messaging-sw.js',
        injectManifest: {
          injectionPoint: undefined,
        },
        manifest: {
          name: 'JCI Kuala Lumpur',
          short_name: 'JCI KL',
          description: 'JCI Kuala Lumpur Member Portal',
          theme_color: '#130f2d',
          background_color: '#130f2d',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
            { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        external: ['@capacitor/app'],
        output: {
          manualChunks: {
            'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/messaging'],
            'vendor-charts':   ['recharts'],
            'vendor-icons':    ['lucide-react'],
            'vendor-calendar': ['react-big-calendar'],
            'vendor-motion':   ['framer-motion'],
            // pdf libs: dynamically imported in PaymentRequestsView, named here for readability
            'vendor-pdf':      ['jspdf', 'pdf-lib'],
            // xlsx removed: now dynamically imported, will be split automatically
          },
        },
      },
    },
  };
});

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
            theme_color: '#1e3a5f',
            background_color: '#1e3a5f',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            icons: [
              { src: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
              { src: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
              { src: '/splash%20screen.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
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
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/messaging'],
              'vendor-charts': ['recharts'],
              'vendor-pdf': ['jspdf', 'pdf-lib'],
              'vendor-excel': ['xlsx'],
              'vendor-calendar': ['react-big-calendar'],
              'vendor-motion': ['framer-motion'],
            },
          },
        },
      },
    };
});

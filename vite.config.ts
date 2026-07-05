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
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            icons: [
              { src: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
              { src: '/favicon-256x256.png', sizes: '256x256', type: 'image/png', purpose: 'any maskable' },
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
      }
    };
});

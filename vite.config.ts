import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // SEC-002: Use 'VITE_' prefix so only VITE_-prefixed vars are loaded.
  // Do NOT use '' (empty prefix) — it loads ALL env vars, including secrets,
  // and anything placed in the define block would be inlined into the browser bundle.
  const env = loadEnv(mode, '.', 'VITE_');
  void env; // env is kept for potential future VITE_ var access; not used for define block below.
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Forward Netlify function calls to the netlify dev server (port 8888).
        // Without this, /.netlify/functions/* 404s when running `npm run dev` alone.
        '/.netlify/functions': 'http://localhost:8888',
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // SW registered manually in main.tsx with updateViaCache: 'none'
        injectRegister: null,
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'firebase-messaging-sw.js',
        injectManifest: {
          injectionPoint: undefined,
        },
        // Navigation fallback is handled manually in firebase-messaging-sw.js (lines 30-41).
        // The workbox block only applies to generateSW strategy, not injectManifest.
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
            { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
            { src: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
            { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    // SEC-002 FIX: Removed define entries for API_KEY and GEMINI_API_KEY.
    // Previously these inlined the Gemini API key into the browser bundle.
    // If the Gemini key is needed server-side, read it via process.env inside the Netlify function.
    // The @google/generative-ai SDK is loaded with the key at call-time in aiPredictionService,
    // which should pass the key from a server endpoint, not from the bundle.
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
'vendor-motion':   ['framer-motion'],
            // pdf libs: split into separate chunks for finer-grained caching
            'vendor-jspdf':    ['jspdf'],
            'vendor-pdf-lib':  ['pdf-lib'],
            // xlsx removed: now dynamically imported, will be split automatically
            // Gemini API is called server-side via Netlify function only, not bundled for browser
            'vendor-swiper':   ['swiper'],
            'vendor-gantt':    ['gantt-task-react'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['**/*.test.ts', '**/*.test.tsx'],
      exclude: ['node_modules/**', 'functions/**', '.netlify/**', '.claude/**'],
    },
  };
});

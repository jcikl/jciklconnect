import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// Dev-only proxy for JCI Malaysia API calls — replicates the Netlify Edge Function
// logic so `npm run dev` works without `netlify dev`.
// In production / netlify dev, the real Edge Functions at /api/* handle these.
function jciMalaysiaDevProxy(): Plugin {
  const JCI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
    Accept: 'application/json, text/plain, */*',
  };

  async function handleEventsProxy(_req: IncomingMessage, res: ServerResponse) {
    try {
      const BASE = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&view=&stat=event-level-manage&level=';
      const LEVELS = ['national', 'area', 'local', 'jci'];
      const results = await Promise.all(LEVELS.map(async (level) => {
        try {
          const r = await fetch(`${BASE}${level}`, { headers: JCI_HEADERS });
          if (!r.ok) return [];
          const text = await r.text();
          if (text.trimStart().startsWith('<')) return [];
          const parsed = JSON.parse(text);
          return Array.isArray(parsed?.data) ? parsed.data : [];
        } catch { return []; }
      }));
      const merged = results.flat();
      const currentYear = new Date().getFullYear();
      const validYears = new Set([String(currentYear), String(currentYear + 1)]);
      const filtered = merged.filter((ev: any) => validYears.has(String(ev.year)));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: filtered.length > 0 ? filtered : merged }));
    } catch (err: any) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  async function handleEventDetails(req: IncomingMessage, res: ServerResponse) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];

      const DETAIL_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&stat=fetch-event&eventid=';
      const fetchDetail = async (id: string) => {
        try {
          const r = await fetch(`${DETAIL_URL}${id}`, { headers: JCI_HEADERS, signal: AbortSignal.timeout(4000) });
          if (!r.ok) return null;
          const text = await r.text();
          if (text.trimStart().startsWith('<')) return null;
          return JSON.parse(text);
        } catch { return null; }
      };

      const parseTime = (raw: string): string => {
        if (!raw) return '';
        const s = String(raw).trim();
        const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
        if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}`;
        const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
        if (ampm) {
          let h = parseInt(ampm[1], 10);
          const m = ampm[2];
          const p = ampm[3].toLowerCase();
          if (p === 'pm' && h < 12) h += 12;
          if (p === 'am' && h === 12) h = 0;
          return `${h.toString().padStart(2, '0')}:${m}`;
        }
        return '';
      };

      const settled = await Promise.allSettled(ids.map(fetchDetail));
      const map: Record<string, { desc: string; lgDesc: string; coHosting: string; startTime: string; endTime: string }> = {};
      ids.forEach((id, i) => {
        const detail = settled[i].status === 'fulfilled' ? settled[i].value : null;
        const root = (detail as any)?.data ?? detail ?? {};
        const raw = root?.cohosting;
        map[id] = {
          desc: root?.desc ?? root?.description ?? '',
          lgDesc: root?.lg_desc ?? root?.long_description ?? root?.lgDesc ?? '',
          coHosting: Array.isArray(raw) ? raw.filter(Boolean).join(', ') : (typeof raw === 'string' ? raw : ''),
          startTime: parseTime(root?.start_time ?? root?.startTime ?? root?.start ?? ''),
          endTime:   parseTime(root?.end_time   ?? root?.endTime   ?? root?.end   ?? ''),
        };
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(map));
    } catch (err: any) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  const PILLAR_KEYS = new Set(['individual', 'community', 'business', 'international', 'lom', 'chapter']);
  const PILLAR_LABELS: Record<string, string> = { individual: 'Individual', community: 'Community', business: 'Business', international: 'International', lom: 'LOM', chapter: 'Chapter' };

  async function handlePageDetails(req: IncomingMessage, res: ServerResponse) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter((id: string) => /^\d+$/.test(id)) : [];

      const PAGE_BASE = 'https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=';

      const fetchPage = async (id: string): Promise<string | null> => {
        try {
          const r = await fetch(`${PAGE_BASE}${id}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)', Accept: 'text/html,application/xhtml+xml' },
            signal: AbortSignal.timeout(4000),
          });
          if (!r.ok) return null;
          const text = await r.text();
          return text.length > 500 ? text : null;
        } catch { return null; }
      };

      const parseHtml = (html: string | null) => {
        if (!html) return { logoUrl: '', pillar: '', priceMin: undefined as number | undefined, priceMax: undefined as number | undefined };
        const logoMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
        const logoUrl = logoMatch ? logoMatch[1].trim() : '';
        let pillar = '';
        const badgeRe = /<span[^>]+class="[^"]*badge[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi;
        let m: RegExpExecArray | null;
        while ((m = badgeRe.exec(html)) !== null) {
          const key = m[1].trim().toLowerCase();
          if (PILLAR_KEYS.has(key)) { pillar = PILLAR_LABELS[key]; break; }
        }
        const priceRe = /(?:MYR|RM)\s*([\d,]+(?:\.\d{1,2})?)/gi;
        const prices: number[] = [];
        while ((m = priceRe.exec(html)) !== null) {
          const val = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(val) && val >= 0 && val < 100000) prices.push(val);
        }
        const priceMin = prices.length > 0 ? Math.min(...prices) : undefined;
        const rawMax = prices.length > 0 ? Math.max(...prices) : undefined;
        const priceMax = rawMax !== undefined && rawMax !== priceMin ? rawMax : undefined;
        return { logoUrl, pillar, priceMin, priceMax };
      };

      // Fetch all pages with concurrency limit 10
      const CONCURRENCY = 10;
      const results: Array<string | null> = new Array(ids.length);
      let idx = 0;
      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= ids.length) break;
          results[i] = await fetchPage(ids[i]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

      const map: Record<string, ReturnType<typeof parseHtml>> = {};
      ids.forEach((id, i) => { map[id] = parseHtml(results[i]); });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(map));
    } catch (err: any) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  async function handleJciProxy(req: IncomingMessage, res: ServerResponse) {
    try {
      const eventId = new URL(req.url ?? '', 'http://localhost').searchParams.get('eventid');
      if (!eventId || !/^\d+$/.test(eventId)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid eventid' }));
        return;
      }
      const r = await fetch(
        `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${eventId}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(6000) }
      );
      if (!r.ok) { res.statusCode = r.status; res.end(JSON.stringify({ error: `Upstream ${r.status}` })); return; }
      const html = await r.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(html);
    } catch (err: any) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  return {
    name: 'jci-malaysia-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/jci-events-proxy', handleEventsProxy as any);
      server.middlewares.use('/api/jci-event-details', handleEventDetails as any);
      server.middlewares.use('/api/jci-page-details', handlePageDetails as any);
      server.middlewares.use('/api/jci-proxy', handleJciProxy as any);
    },
  };
}

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
      jciMalaysiaDevProxy(),
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

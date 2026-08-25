import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function chatDevPlugin(): Plugin {
  return {
    name: 'pv-chat-dev',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks: Buffer[] = [];
          for await (const c of req as AsyncIterable<Buffer>) chunks.push(c);
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const mod = await server.ssrLoadModule('/server/chat.ts');
          const stream: ReadableStream<Uint8Array> = mod.createChatStream(
            body.messages ?? [],
            body.locale,
          );
          res.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
          });
          const reader = stream.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'content-type': 'text/plain' });
          res.end(message);
        }
      });
    },
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req as AsyncIterable<Buffer>) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  return header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost:5173';
  const protocol = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const url = `${protocol}://${host}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value) headers.set(key, value);
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Request(url, { method: req.method, headers });
  }

  const chunks: Buffer[] = [];
  for await (const c of req as AsyncIterable<Buffer>) chunks.push(c);
  return new Request(url, {
    method: req.method,
    headers,
    body: Buffer.concat(chunks),
  });
}

async function sendWebResponse(res: ServerResponse, webResponse: Response) {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.end(buffer);
}

function blogDevPlugin(): Plugin {
  const routes = [
    { pattern: /^\/api\/posts$/, module: '/netlify/functions/posts.ts', params: () => ({}) },
    { pattern: /^\/api\/posts\/([^/?#]+)$/, module: '/netlify/functions/posts.ts', params: (m: RegExpMatchArray) => ({ slug: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/comments\/([^/?#]+)$/, module: '/netlify/functions/comments.ts', params: (m: RegExpMatchArray) => ({ slug: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/likes\/([^/?#]+)$/, module: '/netlify/functions/likes.ts', params: (m: RegExpMatchArray) => ({ slug: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/views\/([^/?#]+)$/, module: '/netlify/functions/views.ts', params: (m: RegExpMatchArray) => ({ slug: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/auth\/([^/?#]+)$/, module: '/netlify/functions/auth.ts', params: (m: RegExpMatchArray) => ({ action: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/uploads$/, module: '/netlify/functions/uploads.ts', params: () => ({}) },
    { pattern: /^\/api\/uploads\/([^/?#]+)$/, module: '/netlify/functions/uploads.ts', params: (m: RegExpMatchArray) => ({ key: decodeURIComponent(m[1]) }) },
    { pattern: /^\/api\/calculator-pdf$/, module: '/netlify/functions/calculator-pdf.ts', params: () => ({}) },
    { pattern: /^\/api\/instagram$/, module: '/netlify/functions/instagram.ts', params: () => ({}) },
    { pattern: /^\/api\/instagram\/image\/([^/?#]+)$/, module: '/netlify/functions/instagram.ts', params: (m: RegExpMatchArray) => ({ id: decodeURIComponent(m[1]) }) },
  ];

  return {
    name: 'pv-blog-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const route = routes.find((entry) => pathname.match(entry.pattern));
        if (!route) return next();

        try {
          process.env.NETLIFY_DEV = 'true';
          const match = pathname.match(route.pattern);
          if (!match) return next();
          const mod = await server.ssrLoadModule(route.module);
          const request = await toWebRequest(req);
          const context = {
            params: route.params(match),
            cookies: {
              get: (name: string) => readCookie(req.headers.cookie, name),
            },
          };
          const response = await mod.default(request, context);
          await sendWebResponse(res, response);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[blog-dev]', message);
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}

/**
 * Dev-only middleware that mirrors the /api/contact and /api/blitz Netlify
 * functions so the forms work against `npm run dev`. The real prod path is
 * the Netlify functions in netlify/functions/.
 */
function mailDevPlugin(): Plugin {
  type MailModule = typeof import('./server/mail');
  type BlitzFlowModule = typeof import('./server/blitzFlow');

  const handle = (
    server: ViteDevServer,
    method: keyof Pick<MailModule, 'sendKontaktEmails'>,
  ) => async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== 'POST') return next();
    try {
      const body = await readJson(req);
      const mod = (await server.ssrLoadModule('/server/mail.ts')) as MailModule;
      // We re-validate on the function side; here we just forward.
      await (mod[method] as (p: unknown) => Promise<void>)(body);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mail-dev:${method}]`, message);
      sendJson(res, 500, { error: 'Send failed', detail: message });
    }
  };

  return {
    name: 'pv-mail-dev',
    configureServer(server) {
      server.middlewares.use('/api/contact', handle(server, 'sendKontaktEmails'));
      // Blitz runs the same decision + email flow as the Netlify function.
      // Prod validates/sanitizes in the function; dev forwards the raw body
      // (as before) and skips the audit store — no dedup/persistence locally.
      server.middlewares.use('/api/blitz', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const body = await readJson(req);
          const flow = (await server.ssrLoadModule('/server/blitzFlow.ts')) as BlitzFlowModule;
          const result = await flow.processBlitzSubmission(
            body as Parameters<BlitzFlowModule['processBlitzSubmission']>[0],
          );
          sendJson(res, 200, { ok: true, mode: result.mode });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[mail-dev:blitz]', message);
          sendJson(res, 500, { error: 'Send failed', detail: message });
        }
      });
      // Month availability for the /kontakt date picker (mirrors /api/termine).
      server.middlewares.use('/api/termine', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const month = new URL(req.url ?? '', 'http://localhost').searchParams.get('month') ?? '';
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            sendJson(res, 400, { error: 'invalid month' });
            return;
          }
          const mod = (await server.ssrLoadModule('/server/terminAvailability.ts')) as
            typeof import('./server/terminAvailability');
          sendJson(res, 200, await mod.getMonthAvailability(month));
        } catch (err) {
          console.error('[mail-dev:termine]', err instanceof Error ? err.message : err);
          sendJson(res, 200, { configured: false, days: {}, slots: {} });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ANTHROPIC_API_KEY', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO_OFFICE', 'MAIL_DRY_RUN', 'MONGODB_URI', 'MONGODB_DB', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ADMIN_GOOGLE_EMAIL', 'GOOGLE_CALENDAR_ID', 'GOOGLE_SA_EMAIL', 'GOOGLE_SA_KEY', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USERNAME', 'INSTAGRAM_POST_LIMIT', 'INSTAGRAM_API_VERSION'] as const) {
    if (env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [
      react(),
      chatDevPlugin(),
      mailDevPlugin(),
      blogDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // Only list assets NOT already covered by workbox.globPatterns below.
        // The PNG icons/logo are matched by the `png` glob (with a revision
        // hash); listing them here too produced a second, unrevisioned entry
        // for the same URL, which made Workbox throw
        // `add-to-cache-list-conflicting-entries` and abort SW install.
        includeAssets: ['robots.txt'],
        manifest: {
          name: 'Prima Vista Bauprojekte',
          short_name: 'Prima Vista',
          description:
            'Sanierung & Renovierung aus einer Hand — für Wohnsitz, Gastronomie und Büros, in Deutschland und der Schweiz.',
          theme_color: '#1a1a1a',
          background_color: '#e8dfdf',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'de',
          categories: ['business', 'lifestyle'],
          icons: [
            {
              src: '/assets/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Cap files at 4 MB so Workbox doesn't refuse our larger WebP heroes.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,woff2,webp,svg,png,ico}'],
          // The PWA manifest icons are already injected into the precache
          // (with revision:null) by vite-plugin-pwa. Letting the png glob also
          // match them adds a second, hash-revisioned entry for the same URL,
          // which makes Workbox throw `add-to-cache-list-conflicting-entries`
          // and abort SW install. Ignore them here so each appears only once.
          globIgnores: ['**/assets/icons/icon-*.png'],
          navigateFallback: '/index.html',
          // Don't fall back to index.html for API or function URLs.
          navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
          runtimeCaching: [
            {
              // Must precede the generic image rule — Workbox matches in order.
              // Instagram tiles refresh as new posts arrive, and letting them
              // share the 80-entry pv-images LRU would evict the site's own
              // hero photos. Their URLs are id-addressed and immutable, so
              // CacheFirst in a separate bucket is safe.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/instagram/image/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pv-instagram',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'pv-images',
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'pv-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          // Keep the SW off during dev so HMR isn't intercepted.
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replaceAll('\\', '/');
            if (normalized.includes('/src/i18n/catalog/')) return 'i18n-catalog';
            const localeMatch = normalized.match(/\/src\/i18n\/locales\/([^/]+)\//);
            if (localeMatch) return `i18n-${localeMatch[1]}`;
          },
        },
      },
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/.cache/**',
        '**/.tmp/**',
        '**/.output/**',
        '**/coverage/**',
        '**/.claude/**',
      ],
    },
    server: { host: true, port: Number(process.env.PORT) || 5177, strictPort: true, open: !process.env.PORT },
  };
});

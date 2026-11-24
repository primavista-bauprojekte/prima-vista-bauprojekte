// Streams the showroom catalogues from the client's WordPress media library so
// pdf.js can read them same-origin (that host sends no CORS headers).
//
// This is deliberately not a netlify.toml rewrite: rewrites pass the visitor's
// request headers on, and the admin session cookie is scoped to `Path=/`. Only
// `Range` is forwarded here, only the files below are reachable, and the
// response is always labelled as a PDF.

const UPSTREAM = 'https://bau-primavista.de/wp-content/uploads';

export const CATALOGUE_FILES = new Set([
  '2026/10/Katalog_Boden_2026_2027_Prima_Vista_CH_final.pdf',
  '2026/10/Prima-Vista-Katalog-2026.pdf',
  '2026/11/Prima_Vista_Tuerenkatalog.pdf',
  '2026/11/PrimaVista_Bauprojekte_Catalogo.pdf',
  '2026/11/Prima-Vista-Fassadenkatalog-2026.pdf',
  '2026/11/PrimaVista_Fenster_Tueren_Katalog_DE_40_Seiten_Web.pdf',
  '2026/11/PrimaVista_Parkett_Katalog_DE_Kompakt_Web.pdf',
]);

const PASS_THROUGH = ['content-length', 'content-range', 'etag', 'last-modified'];

export default async function kataloge(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const file = new URL(request.url).pathname.replace(/^\/kataloge\//, '');
  if (!CATALOGUE_FILES.has(file)) return new Response('Not found', { status: 404 });

  const range = request.headers.get('range');
  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/${file}`, {
      method: request.method,
      // Compression would invalidate the byte offsets pdf.js asks for.
      headers: { 'accept-encoding': 'identity', ...(range ? { range } : {}) },
      redirect: 'error',
    });
  } catch {
    return new Response('Catalogue unavailable', { status: 502 });
  }

  const isPdf = upstream.headers.get('content-type')?.startsWith('application/pdf');
  const accepted = upstream.status === 416 || ((upstream.status === 200 || upstream.status === 206) && isPdf);
  if (!accepted) {
    await upstream.body?.cancel();
    return new Response('Catalogue unavailable', { status: 502 });
  }

  const headers = new Headers({
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=3600',
    'content-disposition': 'inline',
    'content-type': 'application/pdf',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
  });
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const config = { path: '/kataloge/*' };

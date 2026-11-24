import { afterEach, describe, expect, it, vi } from 'vitest';
import kataloge, { CATALOGUE_FILES } from '../../netlify/edge-functions/kataloge';
import { CATALOGUE_BASE, MATERIAL_CATALOGUES } from '../../src/data/materialien';

const FILE = MATERIAL_CATALOGUES[0].file;
const request = (path: string, init?: RequestInit) => new Request(`https://example.test${path}`, init);

function stubUpstream(status = 206, type = 'application/pdf') {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('pdf', {
    status,
    headers: { 'content-type': type, 'content-range': 'bytes 0-2/3', 'set-cookie': 'x=1' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('catalogue edge function', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('allows exactly the catalogues the showroom lists', () => {
    const listed = MATERIAL_CATALOGUES.map((entry) => entry.file.slice(CATALOGUE_BASE.length + 1));
    expect([...CATALOGUE_FILES].sort()).toEqual(listed.sort());
  });

  it('forwards the range but never cookies or authorization', async () => {
    const fetchMock = stubUpstream();
    const response = await kataloge(request(FILE, {
      headers: { range: 'bytes=0-2', cookie: 'session=secret', authorization: 'Bearer secret' },
    }));
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'accept-encoding': 'identity', range: 'bytes=0-2' });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-range')).toBe('bytes 0-2/3');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects unlisted paths and other methods without contacting the upstream', async () => {
    const fetchMock = stubUpstream();
    expect((await kataloge(request('/kataloge/2026/10/other.pdf'))).status).toBe(404);
    expect((await kataloge(request(FILE, { method: 'POST' }))).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[200, 'text/html'], [404, 'application/pdf'], [500, 'text/html']])('hides a %s %s upstream answer', async (status, type) => {
    stubUpstream(status, type);
    expect((await kataloge(request(FILE))).status).toBe(502);
  });

  it('reports an unreachable upstream', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await kataloge(request(FILE))).status).toBe(502);
  });
});

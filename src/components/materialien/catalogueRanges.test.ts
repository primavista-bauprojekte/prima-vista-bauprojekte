import { afterEach, describe, expect, it, vi } from 'vitest';
import { RANGE_CHUNK, openCatalogue } from './catalogueRanges';

const file = Uint8Array.from({ length: RANGE_CHUNK * 4 + 1000 }, (_, index) => index % 251);

function serve(respond: (range: string) => Response) {
  const spy = vi.fn((_url: string, init: RequestInit) =>
    Promise.resolve(respond((init.headers as Record<string, string>).Range.replace('bytes=', ''))));
  vi.stubGlobal('fetch', spy);
  return spy;
}

function partial(range: string, total = file.length) {
  const [from, to] = range.split('-');
  const begin = from === '' ? file.length - Number(to) : Number(from);
  const end = from === '' ? file.length : Math.min(Number(to) + 1, file.length);
  return new Response(file.slice(begin, end), {
    status: 206,
    headers: { 'Content-Range': `bytes ${begin}-${end - 1}/${total}` },
  });
}

const open = () => openCatalogue('/kataloge/x.pdf', new AbortController().signal);

describe('openCatalogue', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads blocks on demand', async () => {
    const spy = serve((range) => partial(range));
    const source = await open();
    if (!('read' in source)) throw new Error('expected ranges');
    expect(source.length).toBe(file.length);
    expect(await source.read(0, RANGE_CHUNK)).toEqual(file.slice(0, RANGE_CHUNK));
    expect(await source.read(RANGE_CHUNK * 4, RANGE_CHUNK * 5)).toEqual(file.slice(RANGE_CHUNK * 4));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await source.read(RANGE_CHUNK, RANGE_CHUNK * 2)).toEqual(file.slice(RANGE_CHUNK, RANGE_CHUNK * 2));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('requests everything a page needs at once, adjacent blocks together', async () => {
    const spy = serve((range) => partial(range));
    const map = { size: file.length, pages: [[0, 4], [0, 1, 2, 4]] };
    const source = await openCatalogue('/kataloge/x.pdf', new AbortController().signal, map, 2);
    if (!('read' in source)) throw new Error('expected ranges');
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await source.read(RANGE_CHUNK, RANGE_CHUNK * 3)).toEqual(file.slice(RANGE_CHUNK, RANGE_CHUNK * 3));
    expect(await source.read(RANGE_CHUNK * 4, RANGE_CHUNK * 5)).toEqual(file.slice(RANGE_CHUNK * 4));
    source.prefetch(1);
    source.prefetch(2);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('ignores a map made for another version of the file', async () => {
    serve((range) => partial(range));
    const map = { size: file.length - 500, pages: [[0, 4]] };
    const source = await openCatalogue('/kataloge/x.pdf', new AbortController().signal, map, 1);
    if (!('read' in source)) throw new Error('expected ranges');
    expect(await source.read(RANGE_CHUNK * 4, file.length)).toEqual(file.slice(RANGE_CHUNK * 4));
  });

  it('falls back to the whole file when ranges are ignored', async () => {
    serve(() => new Response(file));
    expect(await open()).toEqual({ data: file });
  });

  it('refetches ranges cut from a compressed cached copy', async () => {
    const spy = vi.fn((_url: string, init: RequestInit) => {
      const response = partial((init.headers as Record<string, string>).Range.replace('bytes=', ''));
      if (init.cache !== 'no-store') response.headers.set('Content-Encoding', 'br');
      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', spy);
    const source = await open();
    if (!('read' in source)) throw new Error('expected ranges');
    expect(await source.read(0, RANGE_CHUNK)).toEqual(file.slice(0, RANGE_CHUNK));
    expect(spy.mock.calls.every(([url]) => url === '/kataloge/x.pdf?ranges')).toBe(true);
  });

  it('rejects missing files and files replaced while open', async () => {
    serve(() => new Response('', { status: 404 }));
    await expect(open()).rejects.toThrow('404');

    let total = file.length;
    serve((range) => partial(range, total));
    const source = await open();
    if (!('read' in source)) throw new Error('expected ranges');
    total += 1;
    await expect(source.read(RANGE_CHUNK, RANGE_CHUNK * 2)).rejects.toThrow('Unexpected');
  });
});

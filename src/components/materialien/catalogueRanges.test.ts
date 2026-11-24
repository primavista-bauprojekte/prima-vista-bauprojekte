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

  it('serves the start and the index from the opening requests', async () => {
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

  it('falls back to the whole file when ranges are ignored', async () => {
    serve(() => new Response(file));
    expect(await open()).toEqual({ data: file });
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

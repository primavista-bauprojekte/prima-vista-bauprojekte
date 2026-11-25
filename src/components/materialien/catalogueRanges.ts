export const RANGE_CHUNK = 128 * 1024;

/** Which blocks each page needs (scripts/map-catalogue-blocks.mjs). */
export type BlockMap = { size: number; pages: number[][] };

export type CatalogueRanges = {
  length: number;
  read: (begin: number, end: number) => Promise<Uint8Array>;
  /** Starts loading everything a page needs, in parallel. */
  prefetch: (page: number) => void;
};

/** Ranges of a file, or its full bytes if the server ignores ranges. */
export type CatalogueSource = { data: Uint8Array } | CatalogueRanges;

type Block = { begin: number; total: number; bytes: Uint8Array };

async function fetchBlock(url: string, range: string, signal: AbortSignal): Promise<Block | Uint8Array> {
  const request = { headers: { Range: `bytes=${range}` }, signal };
  // Browsers cut ranges out of a cached full download (the PDF button), which is
  // compressed. The query gives ranges a cache entry of their own.
  let response = await fetch(`${url}?ranges`, request);
  if (response.status === 206 && response.headers.has('Content-Encoding')) {
    void response.body?.cancel().catch(() => undefined);
    response = await fetch(`${url}?ranges`, { ...request, cache: 'no-store' });
    if (response.status === 206 && response.headers.has('Content-Encoding')) {
      throw new Error('Compressed catalogue range response');
    }
  }
  if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
  const match = /^bytes (\d+)-\d+\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (response.status !== 206) return bytes;
  if (!match) throw new Error('Catalogue range response without Content-Range');
  return { begin: Number(match[1]), total: Number(match[2]), bytes };
}

/**
 * Netlify serves whole PDFs Brotli-compressed, and pdf.js refuses to use ranges
 * once it sees a Content-Encoding. Range responses are not compressed, so ask
 * for them directly. pdf.js also discovers what a page needs one step at a
 * time; the block map lets all of it be requested at once.
 */
export async function openCatalogue(
  url: string,
  signal: AbortSignal,
  map?: BlockMap,
  firstPage = 1,
): Promise<CatalogueSource> {
  const blocks = new Map<number, Promise<Uint8Array>>();
  /** Already handed to pdf.js, which keeps its own copy. */
  const delivered = new Set<number>();

  const load = (first: number, last: number, length: number) => {
    const begin = first * RANGE_CHUNK;
    const end = Math.min((last + 1) * RANGE_CHUNK, length);
    const request = fetchBlock(url, `${begin}-${end - 1}`, signal).then((block) => {
      // A different total means the file was replaced while it was open.
      if (block instanceof Uint8Array || block.begin !== begin || block.total !== length
        || block.bytes.length !== end - begin) {
        throw new Error('Unexpected catalogue range response');
      }
      return block.bytes;
    });
    for (let index = first; index <= last; index += 1) {
      const offset = (index - first) * RANGE_CHUNK;
      const part = request.then((bytes) => bytes.subarray(offset, offset + RANGE_CHUNK));
      // Forget failures so that the next read asks again.
      part.catch(() => {
        if (blocks.get(index) === part) blocks.delete(index);
      });
      blocks.set(index, part);
    }
  };

  /** Requests the missing blocks, adjacent ones together. */
  const ensure = (wanted: number[], length: number) => {
    const missing = wanted.filter((index) => !blocks.has(index) && index * RANGE_CHUNK < length);
    for (let i = 0; i < missing.length;) {
      let j = i;
      while (missing[j + 1] === missing[j] + 1) j += 1;
      load(missing[i], missing[j], length);
      i = j + 1;
    }
  };

  const wantedFor = (page: number) => (map?.pages[page - 1] ?? []).filter((index) => !delivered.has(index));
  // With a map the rest of the page can be requested before the first reply.
  if (map) ensure(wantedFor(firstPage).filter((index) => index > 0), map.size);

  const head = await fetchBlock(url, `0-${RANGE_CHUNK - 1}`, signal);
  if (head instanceof Uint8Array) return { data: head };
  const length = head.total;
  // A map made for another version of the file only costs the early requests.
  const mapFits = map?.size === length;
  if (!mapFits) blocks.clear();
  blocks.set(0, Promise.resolve(head.bytes));

  return {
    length,
    read: async (begin, end) => {
      const last = Math.min(end, length);
      const indexes: number[] = [];
      for (let index = Math.floor(begin / RANGE_CHUNK); index * RANGE_CHUNK < last; index += 1) indexes.push(index);
      ensure(indexes, length);
      const parts = await Promise.all(indexes.map((index) => blocks.get(index) as Promise<Uint8Array>));
      const result = new Uint8Array(last - begin);
      parts.forEach((part, i) => {
        const start = indexes[i] * RANGE_CHUNK;
        const from = Math.max(begin - start, 0);
        const to = Math.min(last - start, part.length);
        result.set(part.subarray(from, to), start + from - begin);
        delivered.add(indexes[i]);
        blocks.delete(indexes[i]);
      });
      return result;
    },
    prefetch: (page) => {
      if (mapFits) ensure(wantedFor(page), length);
    },
  };
}

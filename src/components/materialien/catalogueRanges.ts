export const RANGE_CHUNK = 128 * 1024;

type Block = { begin: number; total: number; bytes: Uint8Array };

/** A file that can be read in pieces, or its full bytes if the server ignores ranges. */
export type CatalogueRanges =
  | { data: Uint8Array }
  | { length: number; read: (begin: number, end: number) => Promise<Uint8Array> };

async function fetchBlock(url: string, range: string, signal: AbortSignal): Promise<Block | Uint8Array> {
  const response = await fetch(url, { headers: { Range: `bytes=${range}` }, signal });
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
 * for them directly: the first block and the index at the end, in parallel.
 */
export async function openCatalogue(url: string, signal: AbortSignal): Promise<CatalogueRanges> {
  const tailRequest = fetchBlock(url, `-${RANGE_CHUNK}`, signal).catch(() => null);
  const head = await fetchBlock(url, `0-${RANGE_CHUNK - 1}`, signal);
  if (head instanceof Uint8Array) return { data: head };

  const length = head.total;
  const tail = await tailRequest;
  const known = [head];
  if (tail && !(tail instanceof Uint8Array) && tail.total === length) known.push(tail);

  const read = async (begin: number, end: number) => {
    const last = Math.min(end, length);
    const hit = known.find((block) => block.begin <= begin && last <= block.begin + block.bytes.length);
    if (hit) return hit.bytes.slice(begin - hit.begin, last - hit.begin);
    const block = await fetchBlock(url, `${begin}-${last - 1}`, signal);
    // A different total means the file was replaced while it was open.
    if (block instanceof Uint8Array || block.begin !== begin || block.total !== length
      || block.bytes.length !== last - begin) {
      throw new Error('Unexpected catalogue range response');
    }
    return block.bytes;
  };
  return { length, read };
}

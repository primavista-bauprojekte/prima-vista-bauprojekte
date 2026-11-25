// Records which 128 KB blocks pdf.js reads to show each catalogue page, so the
// reader can request them together. Re-run after changing a file in
// public/kataloge: node scripts/map-catalogue-blocks.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PDFDataRangeTransport, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const CHUNK = 128 * 1024;
const DIR = 'public/kataloge';

async function blocksFor(bytes, page) {
  const blocks = new Set();
  class Recorder extends PDFDataRangeTransport {
    requestDataRange(begin, end) {
      for (let block = begin / CHUNK; block * CHUNK < end; block += 1) blocks.add(block);
      queueMicrotask(() => this.onDataRange(begin, new Uint8Array(bytes.subarray(begin, end))));
    }
  }
  const task = getDocument({
    range: new Recorder(bytes.length, null),
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: CHUNK,
    useWasm: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  await pdf.getPage(Math.min(2, pdf.numPages));
  await (await pdf.getPage(page)).getOperatorList();
  const { numPages } = pdf;
  await task.destroy();
  return { numPages, blocks: [...blocks].sort((a, b) => a - b) };
}

const map = {};
for (const name of readdirSync(DIR).filter((entry) => entry.endsWith('.pdf')).sort()) {
  const bytes = readFileSync(`${DIR}/${name}`);
  const pages = [];
  let total = 1;
  for (let page = 1; page <= total; page += 1) {
    const { numPages, blocks } = await blocksFor(bytes, page);
    total = numPages;
    pages.push(blocks);
  }
  map[`/kataloge/${name}`] = { size: bytes.length, pages };
  const counts = pages.map((blocks) => blocks.length);
  console.log(name, 'pages', total, 'avg blocks', (counts.reduce((a, b) => a + b, 0) / total).toFixed(1), 'max', Math.max(...counts));
}
writeFileSync('src/data/catalogueBlocks.json', `${JSON.stringify(map)}\n`);

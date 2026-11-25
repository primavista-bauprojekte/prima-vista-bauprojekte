import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { PageFlip } from 'page-flip';
import {
  GlobalWorkerOptions,
  PDFDataRangeTransport,
  PDFWorker,
  getDocument,
  version,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { businessContact } from '../../../shared/contact';
import type { MaterialCatalogue } from '../../data/materialien';
import { RANGE_CHUNK, openCatalogue, type BlockMap, type CatalogueRanges } from './catalogueRanges';
import catalogueBlocks from '../../data/catalogueBlocks.json';
import { MERKLISTE_LIMIT, isSaved, type SavedPage } from '../../data/merkliste';

GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const MAX_RENDER_EDGE = 4096;
/** Pages kept rendered on each side of the open one. */
const WINDOW = 3;
/** Spreads need this much room; below it the book shows single pages. */
const SPREAD_MIN_WIDTH = 900;

type Props = {
  catalogue: MaterialCatalogue;
  initialPage: number;
  onClose: () => void;
  saved: SavedPage[];
  onToggleSaved: (entry: SavedPage) => void;
};
type Layout = { width: number; height: number; spread: boolean };
type Rendered = { scale: number; url: string | null };

const BLOCKS: Partial<Record<string, BlockMap>> = catalogueBlocks;

class RangeTransport extends PDFDataRangeTransport {
  #source: CatalogueRanges;
  #signal: AbortSignal;
  #onError: () => void;

  constructor(source: CatalogueRanges, signal: AbortSignal, onError: () => void) {
    super(source.length, null);
    this.#source = source;
    this.#signal = signal;
    this.#onError = onError;
  }

  override requestDataRange(begin: number, end: number) {
    const read = () => this.#source.read(begin, end);
    // One retry, so a dropped request does not end the reading session.
    read()
      .catch((error: unknown) => {
        if (this.#signal.aborted) throw error;
        return read();
      })
      .then((bytes) => {
        if (!this.#signal.aborted) this.onDataRange(begin, bytes);
      })
      .catch(() => {
        if (!this.#signal.aborted) this.#onError();
      });
  }
}

const THUMB_WIDTH = 220;

/** Small JPEG of already rendered pages, side by side for a spread. */
function makeThumb(pages: HTMLElement[]): string | undefined {
  const images = pages
    .map((page) => page.querySelector('img'))
    .filter((image): image is HTMLImageElement => Boolean(image?.complete && image.naturalWidth));
  if (images.length === 0) return undefined;
  const each = Math.round(THUMB_WIDTH / images.length);
  const heights = images.map((image) => Math.round((each * image.naturalHeight) / image.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = each * images.length;
  canvas.height = Math.max(...heights);
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((image, index) => context.drawImage(image, index * each, 0, each, heights[index]));
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function CatalogueReader({ catalogue, initialPage, onClose, saved, onToggleSaved }: Props) {
  const { t } = useTranslation('pages');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const renderedRef = useRef(new Map<number, Rendered>());
  const pageRef = useRef(initialPage);
  const sourceRef = useRef<CatalogueRanges | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  const total = doc?.numPages ?? catalogue.pages;
  const base = `material.catalogues.${catalogue.key}`;
  const name = t(`${base}.name`);

  // Native modal dialog: focus trap, inert background and Escape for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      if (dialog.open) dialog.close();
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    // Start the worker while the first blocks are still on their way.
    const worker = new PDFWorker();
    const controller = new AbortController();
    const fail = () => {
      if (cancelled) return;
      setFailed(true);
      controller.abort();
      void task?.destroy();
    };
    (async () => {
      try {
        const source = await openCatalogue(catalogue.file, controller.signal, BLOCKS[catalogue.file], pageRef.current);
        if (cancelled) return;
        sourceRef.current = 'data' in source ? null : source;
        task = getDocument({
          worker,
          ...('data' in source
            ? { data: source.data }
            : { range: new RangeTransport(source, controller.signal, fail) }),
          // Fetch only the byte ranges that are read; the files run to 30 MB.
          disableAutoFetch: true,
          disableStream: true,
          // The files keep their index together at the end and each page's data
          // together, so small blocks suffice (materialien.test.ts guards that).
          rangeChunkSize: RANGE_CHUNK,
          // The site's CSP forbids compiling WebAssembly, so JPEG 2000 images (the
          // furniture catalogue) use pdf.js's plain-JS decoder.
          useWasm: false,
          // Versioned because /assets is cached as immutable.
          wasmUrl: `/assets/pdfjs-${version}/`,
        });
        const pdf = await task.promise;
        // Covers can be single pages in an otherwise spread-format document.
        const sample = await pdf.getPage(Math.min(2, pdf.numPages));
        const { width, height } = sample.getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(width / height);
        setDoc(pdf);
      } catch {
        fail();
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      sourceRef.current = null;
      if (task) void task.destroy().finally(() => worker.destroy());
      else worker.destroy();
    };
  }, [catalogue.file]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ratio) return undefined;
    const measure = () => {
      const availableWidth = Math.max(stage.clientWidth - 32, 120);
      const availableHeight = Math.max(stage.clientHeight - 24, 120);
      const spread = ratio < 1.1 && availableWidth >= SPREAD_MIN_WIDTH;
      const width = Math.floor(Math.min(availableWidth / (spread ? 2 : 1), availableHeight * ratio));
      const next = { width, height: Math.floor(width / ratio), spread };
      setLayout((current) =>
        current && current.width === next.width && current.height === next.height && current.spread === next.spread
          ? current
          : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [ratio]);

  // page-flip owns (and on destroy removes) its DOM, so it gets a node of its own.
  useEffect(() => {
    const host = bookRef.current;
    if (!host || !doc || !layout) return undefined;
    const rendered = renderedRef.current;
    const book = document.createElement('div');
    host.append(book);
    pagesRef.current = Array.from({ length: doc.numPages }, () => {
      const element = document.createElement('div');
      element.className = 'mat-reader__page';
      return element;
    });

    const flip = new PageFlip(book, {
      width: layout.width,
      height: layout.height,
      size: 'fixed',
      startPage: Math.min(pageRef.current, doc.numPages) - 1,
      showCover: true,
      usePortrait: !layout.spread,
      autoSize: false,
      mobileScrollSupport: false,
      disableFlipByClick: true,
      maxShadowOpacity: 0.4,
      flippingTime: 600,
    });
    flip.on('flip', ({ data }) => {
      pageRef.current = data + 1;
      setPage(data + 1);
    });
    flip.loadFromHTML(pagesRef.current);
    flipRef.current = flip;

    return () => {
      flipRef.current = null;
      flip.destroy();
      host.replaceChildren();
      pagesRef.current = [];
      rendered.forEach(({ url }) => url && URL.revokeObjectURL(url));
      rendered.clear();
    };
  }, [doc, layout]);

  // Render a window of pages around the open one; release the rest.
  useEffect(() => {
    if (!doc || !layout) return undefined;
    let cancelled = false;
    const rendered = renderedRef.current;
    const order = [0, 1, -1, 2, -2, 3, -3].map((offset) => page + offset);
    const ratioPx = Math.min(window.devicePixelRatio || 1, 2);

    rendered.forEach(({ url }, number) => {
      if (Math.abs(number - page) <= WINDOW) return;
      if (url) URL.revokeObjectURL(url);
      pagesRef.current[number - 1]?.replaceChildren();
      rendered.delete(number);
    });

    // Both halves of a spread at once; the neighbours follow in turn.
    sourceRef.current?.prefetch(page);
    if (layout.spread) sourceRef.current?.prefetch(page + 1);

    (async () => {
      for (const number of order) {
        if (cancelled) return;
        if (number < 1 || number > doc.numPages) continue;
        const visible = number === page || (layout.spread && number === page + 1);
        const wanted = visible ? zoom : 1;
        const existing = rendered.get(number);
        if (existing && existing.scale >= wanted) continue;
        try {
          sourceRef.current?.prefetch(number);
          const pdfPage = await doc.getPage(number);
          const natural = pdfPage.getViewport({ scale: 1 });
          const fit = Math.min(layout.width / natural.width, layout.height / natural.height);
          const scale = Math.min(
            fit * wanted * ratioPx,
            MAX_RENDER_EDGE / Math.max(natural.width, natural.height),
          );
          const viewport = pdfPage.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await pdfPage.render({ canvas, viewport }).promise;
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          canvas.width = 0;
          canvas.height = 0;
          const element = pagesRef.current[number - 1];
          if (cancelled || !blob || !element) return;
          const image = new Image();
          // An <img> survives the cloning page-flip does in single-page mode.
          image.src = URL.createObjectURL(blob);
          image.alt = '';
          image.draggable = false;
          element.replaceChildren(image);
          if (existing?.url) URL.revokeObjectURL(existing.url);
          rendered.set(number, { scale: wanted, url: image.src });
        } catch {
          if (!cancelled && number === page) setFailed(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [doc, layout, page, zoom]);

  const goTo = useCallback((target: number) => {
    const next = Math.min(Math.max(target, 1), total);
    setZoom(1);
    pageRef.current = next;
    flipRef.current?.turnToPage(next - 1);
    const index = flipRef.current?.getCurrentPageIndex();
    setPage(index === undefined ? next : index + 1);
  }, [total]);

  const step = useCallback((direction: 1 | -1) => {
    const flip = flipRef.current;
    if (!flip) return;
    setZoom(1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // page-flip cannot reliably animate backwards in single-page mode.
    if (reduced || (direction === -1 && !layout?.spread)) {
      if (direction === 1) flip.turnToNextPage();
      else flip.turnToPrevPage();
    } else if (direction === 1) flip.flipNext();
    else flip.flipPrev();
  }, [layout?.spread]);

  const zoomBy = useCallback((delta: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + delta)));
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight' && zoom === 1) step(1);
    else if (event.key === 'ArrowLeft' && zoom === 1) step(-1);
    else if (event.key === '+') zoomBy(ZOOM_STEP);
    else if (event.key === '-') zoomBy(-ZOOM_STEP);
    else return;
    event.preventDefault();
  };

  const isPair = Boolean(layout?.spread) && page > 1 && page < total;
  const shownPages = isPair ? `${page}–${Math.min(page + 1, total)}` : String(page);
  const atEnd = page + (isPair ? 1 : 0) >= total;
  const bookWidth = layout ? layout.width * (layout.spread ? 2 : 1) : 0;
  const sampleHref = `${businessContact.primary.whatsappHref}?text=${encodeURIComponent(
    `${t('material.cta.whatsappText')} ${name}, ${t('material.reader.pageOf', { page: shownPages, total })}`,
  )}`;
  const pdfHref = `${catalogue.file}#page=${page}`;
  const ready = Boolean(doc && layout);
  const marked = isSaved(saved, catalogue.key, page);
  const toggleMark = () => {
    const shown = isPair ? [page, page + 1] : [page];
    onToggleSaved({
      catalogue: catalogue.key,
      page,
      ...(isPair ? { to: page + 1 } : {}),
      thumb: marked ? undefined : makeThumb(shown.map((number) => pagesRef.current[number - 1])),
    });
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="mat-reader"
      aria-label={name}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={onKeyDown}
    >
      <header className="mat-reader__bar">
        <div className="mat-reader__title">
          <span>{t('material.reader.eyebrow')}</span>
          <strong>{name}</strong>
        </div>
        <div className="mat-reader__tools">
          <div role="group" aria-label={t('material.reader.zoomAria')} className="mat-reader__zoom">
            <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={!ready || zoom <= MIN_ZOOM} aria-label={t('material.reader.zoomOut')}>−</button>
            <button type="button" onClick={() => setZoom(1)} disabled={!ready} aria-label={`${t('material.reader.zoomReset')} (${zoom * 100} %)`}>{zoom * 100} %</button>
            <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={!ready || zoom >= MAX_ZOOM} aria-label={t('material.reader.zoomIn')}>+</button>
          </div>
          <button
            type="button"
            className={`mat-reader__mark${marked ? ' is-marked' : ''}`}
            onClick={toggleMark}
            disabled={!ready || (!marked && saved.length >= MERKLISTE_LIMIT)}
            aria-pressed={marked}
            aria-label={t('material.list.save')}
          >
            {marked ? '♥' : '♡'} <span>{marked ? t('material.list.saved') : t('material.list.save')}</span>
          </button>
          <a className="mat-reader__action" href={sampleHref} target="_blank" rel="noopener noreferrer">{t('material.reader.sample')}</a>
          <a className="mat-reader__action" href={pdfHref} target="_blank" rel="noopener noreferrer">{t('material.reader.pdf')}</a>
          <button type="button" className="mat-reader__close" onClick={onClose} aria-label={t('material.reader.close')}>×</button>
        </div>
      </header>

      <div className="mat-reader__stage" ref={stageRef} aria-busy={!ready && !failed}>
        {failed ? (
          <p className="mat-reader__state" role="alert">
            {t('material.reader.error')} <a href={pdfHref} target="_blank" rel="noopener noreferrer">{t('material.openPdf')}</a>
          </p>
        ) : !ready && <p className="mat-reader__state" role="status">{t('material.reader.loading')}</p>}
        <div
          className="mat-reader__sizer"
          hidden={failed}
          style={layout ? { width: bookWidth * zoom, height: layout.height * zoom } : undefined}
        >
          <div
            ref={bookRef}
            className={`mat-reader__book${zoom > 1 ? ' is-zoomed' : ''}`}
            style={layout ? { width: bookWidth, height: layout.height, transform: zoom > 1 ? `scale(${zoom})` : undefined } : undefined}
          />
        </div>
      </div>

      <footer className="mat-reader__foot">
        <button type="button" onClick={() => step(-1)} disabled={!ready || page <= 1} aria-label={t('material.reader.prev')}>‹</button>
        <input
          type="range"
          min={1}
          max={total}
          value={page}
          disabled={!ready}
          onChange={(event) => goTo(Number(event.target.value))}
          aria-label={t('material.reader.jump')}
        />
        <output aria-live="polite">{t('material.reader.pageOf', { page: shownPages, total })}</output>
        <select
          value=""
          disabled={!ready}
          onChange={(event) => goTo(Number(event.target.value))}
          aria-label={t('material.reader.jump')}
        >
          <option value="" disabled>{t('material.reader.jump')}</option>
          {catalogue.chapters.map((chapter) => (
            <option key={chapter.key} value={chapter.page}>
              {t(`${base}.chapters.${chapter.key}`)} · {t('material.pageShort', { page: chapter.page })}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => step(1)} disabled={!ready || atEnd} aria-label={t('material.reader.next')}>›</button>
      </footer>
      <p className="mat-reader__hint">{t('material.reader.hint')}</p>
    </dialog>,
    document.body,
  );
}

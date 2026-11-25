import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import de from '../i18n/locales/de/pages.json';
import en from '../i18n/locales/en/pages.json';
import fr from '../i18n/locales/fr/pages.json';
import it_ from '../i18n/locales/it/pages.json';
import catalogueBlocks from './catalogueBlocks.json';
import {
  MATERIAL_CATALOGUES,
  MATERIAL_CATEGORIES,
  MATERIAL_PARTNERS,
  MATERIAL_SUBCATEGORIES,
  categoryFromHash,
} from './materialien';

function keys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}.${key}`));
}

describe('material showroom data', () => {
  it('only references known categories and valid chapter pages', () => {
    const known = [...MATERIAL_CATEGORIES, ...MATERIAL_SUBCATEGORIES].map((entry) => entry.key as string);
    for (const catalogue of MATERIAL_CATALOGUES) {
      for (const key of catalogue.categories) expect(known).toContain(key);
      for (const chapter of catalogue.chapters) {
        expect(chapter.page).toBeGreaterThanOrEqual(1);
        expect(chapter.page).toBeLessThanOrEqual(catalogue.pages);
      }
    }
  });

  it('has every image and catalogue PDF on disk', () => {
    const files = [
      ...MATERIAL_CATEGORIES.map((entry) => entry.image),
      ...MATERIAL_SUBCATEGORIES.map((entry) => entry.image),
      ...MATERIAL_CATALOGUES.map((entry) => entry.cover),
      ...MATERIAL_CATALOGUES.map((entry) => entry.file),
    ];
    for (const file of files) expect(existsSync(`public${file}`), file).toBe(true);
  });

  it.each([['en', en], ['fr', fr], ['it', it_]])('has the German material keys in %s', (_locale, pages) => {
    expect(keys(pages.material).sort()).toEqual(keys(de.material).sort());
  });

  it('has copy for every category, catalogue, chapter and partner', () => {
    const available = new Set(keys(de.material));
    for (const { key } of MATERIAL_CATEGORIES) expect(available).toContain(`.categories.${key}.name`);
    for (const { key } of MATERIAL_SUBCATEGORIES) expect(available).toContain(`.sub.${key}.name`);
    for (const { key } of MATERIAL_PARTNERS) expect(available).toContain(`.partners.${key}.desc`);
    for (const { key, chapters } of MATERIAL_CATALOGUES) {
      expect(available).toContain(`.catalogues.${key}.name`);
      for (const chapter of chapters) expect(available).toContain(`.catalogues.${key}.chapters.${chapter.key}`);
    }
  });

  it('ships the JPEG 2000 decoder of the installed pdf.js version', () => {
    const { version } = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8')) as { version: string };
    const file = 'openjpeg_nowasm_fallback.js';
    expect(readFileSync(`public/assets/pdfjs-${version}/${file}`, 'utf8'))
      .toBe(readFileSync(`node_modules/pdfjs-dist/wasm/${file}`, 'utf8'));
  });

  it('keeps every catalogue index together at the end (scripts/optimise-catalogues.py)', () => {
    for (const { file } of MATERIAL_CATALOGUES) {
      const pdf = readFileSync(`public${file}`);
      const first = pdf.indexOf('/Type/ObjStm');
      expect(first, file).toBeGreaterThan(-1);
      expect(pdf.length - first, file).toBeLessThan(128 * 1024);
    }
  });

  it('has an up-to-date block map (scripts/map-catalogue-blocks.mjs)', () => {
    const blocks: Partial<Record<string, { size: number; pages: number[][] }>> = catalogueBlocks;
    for (const { file, pages } of MATERIAL_CATALOGUES) {
      expect(blocks[file]?.size, file).toBe(statSync(`public${file}`).size);
      expect(blocks[file]?.pages, file).toHaveLength(pages);
    }
  });

  it('parses category hashes and ignores anything else', () => {
    expect(categoryFromHash('#kategorie=boeden')).toBe('boeden');
    expect(categoryFromHash('#kategorie=%E0%A4%A')).toBeNull();
    expect(categoryFromHash('#kategorie=unknown')).toBeNull();
    expect(categoryFromHash('')).toBeNull();
  });
});

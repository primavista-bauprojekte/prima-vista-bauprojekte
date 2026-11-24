import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import de from '../i18n/locales/de/pages.json';
import en from '../i18n/locales/en/pages.json';
import fr from '../i18n/locales/fr/pages.json';
import it_ from '../i18n/locales/it/pages.json';
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

  it('has an image on disk for every entry', () => {
    const images = [
      ...MATERIAL_CATEGORIES.map((entry) => entry.image),
      ...MATERIAL_SUBCATEGORIES.map((entry) => entry.image),
      ...MATERIAL_CATALOGUES.map((entry) => entry.cover),
    ];
    for (const image of images) expect(existsSync(`public${image}`), image).toBe(true);
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

  it('parses category hashes and ignores anything else', () => {
    expect(categoryFromHash('#kategorie=boeden')).toBe('boeden');
    expect(categoryFromHash('#kategorie=%E0%A4%A')).toBeNull();
    expect(categoryFromHash('#kategorie=unknown')).toBeNull();
    expect(categoryFromHash('')).toBeNull();
  });
});

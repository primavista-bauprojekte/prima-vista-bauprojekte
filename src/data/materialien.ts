// Content model for the material showroom (/materialien).
//
// Categories, supplier collections and catalogues are data only — every label
// lives in the `pages` i18n namespace under `material.*`, so the page
// localizes like the rest of the site. Adding a catalogue means one entry in
// MATERIAL_CATALOGUES plus its copy in the four pages.json files.
//
// Chapter page numbers are PDF page numbers, not the printed numbers that may
// appear on the page itself; the furniture catalogue in particular is laid out
// as spreads, so the two differ.

/** Where the catalogue PDFs are served from. An edge function keeps them
 *  same-origin, which pdf.js requires — see netlify/edge-functions/kataloge.ts,
 *  whose allowlist must name every file below. */
export const CATALOGUE_BASE = '/kataloge';

const IMG = '/assets/img/materialien';

export type MaterialCategoryKey =
  | 'fliesen'
  | 'boeden'
  | 'bad'
  | 'tueren'
  | 'licht'
  | 'fenster';

export type MaterialSubKey = 'vinyl' | 'parkett';

/** Anything the catalogue list can be filtered by. */
export type MaterialFilterKey = MaterialCategoryKey | MaterialSubKey;

export type MaterialIconKey = 'tile' | 'layers' | 'bath' | 'door' | 'bulb' | 'window';

export type MaterialCategory = {
  key: MaterialCategoryKey;
  icon: MaterialIconKey;
  image: string;
};

export type MaterialSubcategory = {
  key: MaterialSubKey;
  parent: MaterialCategoryKey;
  image: string;
};

export type MaterialPartner = {
  key: string;
  /** Manufacturer name — a proper noun, so it is not translated. */
  name: string;
  url: string;
  categories: MaterialCategoryKey[];
};

export type CatalogueChapter = {
  key: string;
  /** 1-based PDF page. */
  page: number;
};

export type MaterialCatalogue = {
  key: string;
  /** Served path of the PDF. */
  file: string;
  cover: string;
  /** Total PDF pages — also the upper bound for every chapter anchor. */
  pages: number;
  categories: MaterialFilterKey[];
  chapters: CatalogueChapter[];
};

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  { key: 'fliesen', icon: 'tile', image: `${IMG}/kategorie-fliesen-naturstein.webp` },
  { key: 'boeden', icon: 'layers', image: `${IMG}/kategorie-boeden-holzdesign.webp` },
  { key: 'bad', icon: 'bath', image: `${IMG}/kategorie-bad-sanitaer.webp` },
  { key: 'tueren', icon: 'door', image: `${IMG}/kategorie-tueren-moebel.webp` },
  { key: 'licht', icon: 'bulb', image: `${IMG}/kategorie-licht-beleuchtung.webp` },
  { key: 'fenster', icon: 'window', image: `${IMG}/kategorie-fenster-fassade.webp` },
];

export const MATERIAL_SUBCATEGORIES: MaterialSubcategory[] = [
  { key: 'vinyl', parent: 'boeden', image: `${IMG}/sub-vinyl-designboden.webp` },
  { key: 'parkett', parent: 'boeden', image: `${IMG}/sub-parkett-naturholz.webp` },
];

export const MATERIAL_PARTNERS: MaterialPartner[] = [
  {
    key: 'atlasConcorde',
    name: 'Atlas Concorde',
    url: 'https://www.atlasconcorde.com/de',
    categories: ['fliesen'],
  },
  {
    key: 'porcelanosa',
    name: 'Porcelanosa',
    url: 'https://www.porcelanosa.com/',
    categories: ['fliesen'],
  },
  {
    key: 'kgm',
    name: 'KGM Holzerzeugnisse',
    url: 'https://www.kgm-online.de/kgm-holzerzeugnisse',
    categories: ['boeden'],
  },
  {
    key: 'reisser',
    name: 'Reisser',
    url: 'https://www.reisser.de/',
    categories: ['bad'],
  },
  {
    key: 'livingDesign',
    name: 'Living Design Frankfurt',
    url: 'https://livingdesign-frankfurt.de/',
    categories: ['licht'],
  },
];

export const MATERIAL_CATALOGUES: MaterialCatalogue[] = [
  {
    key: 'boden',
    file: `${CATALOGUE_BASE}/2026/10/Katalog_Boden_2026_2027_Prima_Vista_CH_final.pdf`,
    cover: `${IMG}/cover-boden-designboden.webp`,
    pages: 128,
    categories: ['boeden', 'vinyl'],
    chapters: [
      { key: 'chevron', page: 20 },
      { key: 'herringbone', page: 28 },
      { key: 'primeOak', page: 38 },
      { key: 'stone', page: 96 },
      { key: 'technical', page: 124 },
    ],
  },
  {
    key: 'moebelTueren',
    file: `${CATALOGUE_BASE}/2026/10/Prima-Vista-Katalog-2026.pdf`,
    cover: `${IMG}/cover-moebel-tueren.webp`,
    pages: 63,
    categories: ['tueren'],
    chapters: [
      { key: 'kollektion', page: 7 },
      { key: 'moebel', page: 14 },
      { key: 'kuechen', page: 31 },
      { key: 'tueren', page: 38 },
      { key: 'glas', page: 46 },
    ],
  },
  {
    key: 'weisslack',
    file: `${CATALOGUE_BASE}/2026/11/Prima_Vista_Tuerenkatalog.pdf`,
    cover: `${IMG}/cover-weisslacktueren.webp`,
    pages: 63,
    categories: ['tueren'],
    chapters: [
      { key: 'standard', page: 5 },
      { key: 'elegance', page: 10 },
      { key: 'royal', page: 24 },
      { key: 'glas', page: 41 },
    ],
  },
  {
    key: 'bad',
    file: `${CATALOGUE_BASE}/2026/11/PrimaVista_Bauprojekte_Catalogo.pdf`,
    cover: `${IMG}/cover-bad-ausstattung.webp`,
    pages: 89,
    categories: ['bad'],
    chapters: [
      { key: 'basic', page: 5 },
      { key: 'classic', page: 27 },
      { key: 'premium', page: 49 },
      { key: 'technical', page: 68 },
    ],
  },
  {
    key: 'fassaden',
    file: `${CATALOGUE_BASE}/2026/11/Prima-Vista-Fassadenkatalog-2026.pdf`,
    cover: `${IMG}/cover-fassaden.webp`,
    pages: 52,
    categories: ['boeden', 'fenster'],
    chapters: [
      { key: 'hpl', page: 8 },
      { key: 'thermoholz', page: 16 },
      { key: 'linax', page: 24 },
      { key: 'bambus', page: 32 },
      { key: 'bpc', page: 40 },
    ],
  },
  {
    key: 'fensterTueren',
    file: `${CATALOGUE_BASE}/2026/11/PrimaVista_Fenster_Tueren_Katalog_DE_40_Seiten_Web.pdf`,
    cover: `${IMG}/cover-fenster-tueren.webp`,
    pages: 40,
    categories: ['fenster'],
    chapters: [
      { key: 'pvc', page: 5 },
      { key: 'aluminium', page: 10 },
      { key: 'holz', page: 16 },
      { key: 'haustueren', page: 22 },
    ],
  },
  {
    key: 'parkett',
    file: `${CATALOGUE_BASE}/2026/11/PrimaVista_Parkett_Katalog_DE_Kompakt_Web.pdf`,
    cover: `${IMG}/cover-parkett.webp`,
    pages: 40,
    categories: ['boeden', 'parkett'],
    chapters: [
      { key: 'verlegemuster', page: 5 },
      { key: 'oberflaechen', page: 7 },
      { key: 'farben', page: 13 },
      { key: 'sortierungen', page: 23 },
      { key: 'formate', page: 30 },
    ],
  },
];

/** Sub-categories belonging to a category, in display order. */
export function subcategoriesOf(category: MaterialCategoryKey): MaterialSubcategory[] {
  return MATERIAL_SUBCATEGORIES.filter((sub) => sub.parent === category);
}

/** Catalogues shown for a category or one of its sub-categories. */
export function cataloguesFor(filter: MaterialFilterKey): MaterialCatalogue[] {
  return MATERIAL_CATALOGUES.filter((entry) => entry.categories.includes(filter));
}

/** Supplier collections shown for a category. */
export function partnersFor(category: MaterialCategoryKey): MaterialPartner[] {
  return MATERIAL_PARTNERS.filter((partner) => partner.categories.includes(category));
}

/** How many catalogues and supplier links a category tile advertises. */
export function categoryCounts(category: MaterialCategoryKey): {
  catalogues: number;
  partners: number;
} {
  const keys: MaterialFilterKey[] = [category, ...subcategoriesOf(category).map((sub) => sub.key)];
  const catalogues = MATERIAL_CATALOGUES.filter((entry) =>
    entry.categories.some((key) => keys.includes(key)),
  ).length;

  return { catalogues, partners: partnersFor(category).length };
}

/** `#kategorie=…` value for a category, used for deep links. */
export const CATEGORY_HASH_PREFIX = '#kategorie=';

export function categoryFromHash(hash: string): MaterialCategoryKey | null {
  if (!hash.startsWith(CATEGORY_HASH_PREFIX)) return null;
  const value = hash.slice(CATEGORY_HASH_PREFIX.length);
  const match = MATERIAL_CATEGORIES.find((category) => category.key === value);
  return match ? match.key : null;
}

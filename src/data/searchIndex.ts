// Lightweight static index for the navbar search. Each entry points at a
// canonical German path and references existing, parity-checked i18n keys
// (ns-prefixed) for its label/lead — so search results localize automatically.
// Magazine posts are added at runtime from the posts API (see SearchBar).

export type SearchGroup = 'page' | 'service';

export type SearchEntry = {
  /** Canonical German path; the localized <Link> rewrites it per locale. */
  path: string;
  group: SearchGroup;
  /** i18n key (ns-prefixed) for the display label. */
  label: string;
  /** Optional i18n key (ns-prefixed) for the secondary line. */
  lead?: string;
};

const leaf = (path: string, key: string): SearchEntry => ({
  path,
  group: 'service',
  label: `kalk:${key}.label`,
  lead: `kalk:${key}.lead`,
});

export const SEARCH_INDEX: SearchEntry[] = [
  // ── Top-level pages ─────────────────────────────────────────────────────
  { path: '/', group: 'page', label: 'common:nav.home' },
  { path: '/komplett-pakete', group: 'page', label: 'common:nav.packages' },
  { path: '/gewerke', group: 'page', label: 'common:nav.trades' },
  { path: '/heizmethoden', group: 'page', label: 'common:nav.heating' },
  { path: '/projekte', group: 'page', label: 'common:nav.projects' },
  { path: '/materialien', group: 'page', label: 'common:nav.materials', lead: 'pages:material.lede' },
  { path: '/blog', group: 'page', label: 'common:nav.magazine' },
  { path: '/kalkulator', group: 'page', label: 'common:nav.calculator' },
  { path: '/kontakt', group: 'page', label: 'common:nav.contact' },
  { path: '/blitz-angebot', group: 'page', label: 'common:cta.expressQuote' },

  // ── Packages ────────────────────────────────────────────────────────────
  leaf('/haus-sanierung', 'leaves.pakete.haus'),
  leaf('/wohnung-sanierung', 'leaves.pakete.wohnung'),
  leaf('/gastronomie-ausbau', 'leaves.pakete.gastronomie'),
  leaf('/buero-ausbau', 'leaves.pakete.buero'),

  // ── Trades ──────────────────────────────────────────────────────────────
  leaf('/badsanierung', 'leaves.gewerke.bad'),
  leaf('/kuechen-moebelbau', 'leaves.gewerke.kueche'),
  leaf('/boeden-belaege', 'leaves.gewerke.boden'),
  leaf('/elektroinstallation', 'leaves.gewerke.elektro'),
  leaf('/sanitaerinstallation', 'leaves.gewerke.sanitaer'),
  leaf('/trockenbau', 'leaves.gewerke.trockenbau'),
  leaf('/maler-lackierer', 'leaves.gewerke.maler'),
  leaf('/fassadensanierung', 'leaves.gewerke.fassade'),
  leaf('/dachsanierung', 'leaves.gewerke.dach'),
  leaf('/abdichtung-keller', 'leaves.gewerke.abdichtung'),
  leaf('/treppen-gelaender', 'leaves.gewerke.treppen'),
  leaf('/garten-aussenanlagen', 'leaves.gewerke.garten'),
  leaf('/barrierefreiheit', 'leaves.gewerke.barrierefreiheit'),
  leaf('/fenstertechnik', 'leaves.gewerke.fenster'),
  leaf('/rohbau-abbruch', 'leaves.gewerke.rohbau'),
  leaf('/tueren-zargen', 'leaves.gewerke.tueren'),
  leaf('/zaeune', 'leaves.gewerke.zaeune'),

  // ── Heating ─────────────────────────────────────────────────────────────
  leaf('/heizkoerper', 'leaves.heizung.heizkoerper'),
  leaf('/heizstraenge', 'leaves.heizung.heizstraenge'),
  leaf('/fussbodenheizung', 'leaves.heizung.fussboden'),
  leaf('/waermepumpe', 'leaves.heizung.waermepumpe'),
  leaf('/gas-heizung', 'leaves.heizung.gas'),
  leaf('/pelletofen', 'leaves.heizung.pellet'),
  leaf('/saunaofen', 'leaves.heizung.sauna'),
];

/** Group order + the common.search.* key for each group's heading. */
export const SEARCH_GROUP_LABELS: Record<SearchGroup | 'magazine', string> = {
  page: 'search.groupPages',
  service: 'search.groupServices',
  magazine: 'search.groupMagazine',
};

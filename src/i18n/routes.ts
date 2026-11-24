// Central route registry for the trilingual site.
//
// German is the default locale and keeps its original, un-prefixed URLs so the
// existing SEO and bookmarks never break. English and Italian live under a
// `/en` and `/it` prefix AND get fully translated slugs, e.g.
//   DE  /gewerke           (canonical)
//   EN  /en/trades
//   IT  /it/mestieri
//
// The German path is the canonical identity of a page everywhere in the code.
// Components keep linking with German paths (`to="/gewerke"`) and the localized
// <Link> wrapper rewrites them to the active locale. Routing, the language
// switcher and hreflang tags are all generated from the table below.

export const LOCALES = ['de', 'en', 'it', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

export const LOCALE_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
};

/** Short label shown inside the language switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
  de: 'DE',
  en: 'EN',
  it: 'IT',
  fr: 'FR',
};

/** `<html lang>` / hreflang attribute value for each locale. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  de: 'de',
  en: 'en',
  it: 'it',
  fr: 'fr',
};

type SlugMap = Record<Exclude<Locale, 'de'>, string>;

// canonical German path (without leading slash) -> { en, it } slug.
// Dynamic segments keep their `:param` placeholder; only the static prefix is
// translated, the content slug tail is preserved as-is.
const SLUGS: Record<string, SlugMap> = {
  'gewerke': { en: 'trades', it: 'mestieri', fr: 'travaux' },
  'badsanierung': { en: 'bathroom-renovation', it: 'ristrutturazione-bagno', fr: 'renovation-salle-de-bain' },
  'badsanierung-gaeste-wc': { en: 'bathroom-guest-wc', it: 'bagno-ospiti', fr: 'salle-de-bain-wc-invites' },
  'kuechen-moebelbau': { en: 'kitchens-cabinetry', it: 'cucine-mobili', fr: 'cuisines-menuiserie' },
  'boeden-belaege': { en: 'floors-coverings', it: 'pavimenti-rivestimenti', fr: 'sols-revetements' },
  'elektroinstallation': { en: 'electrical-installation', it: 'impianto-elettrico', fr: 'installation-electrique' },
  'trockenbau': { en: 'drywall', it: 'cartongesso', fr: 'cloisons-seches' },
  'maler-lackierer': { en: 'painting-decorating', it: 'pittura-verniciatura', fr: 'peinture-laquage' },
  'fassadensanierung': { en: 'facade-renovation', it: 'ristrutturazione-facciata', fr: 'renovation-facade' },
  'abdichtung-keller': { en: 'waterproofing-basement', it: 'impermeabilizzazione-cantina', fr: 'etancheite-cave' },
  'dachsanierung': { en: 'roof-renovation', it: 'ristrutturazione-tetto', fr: 'renovation-toiture' },
  'treppen-gelaender': { en: 'stairs-railings', it: 'scale-ringhiere', fr: 'escaliers-garde-corps' },
  'garten-aussenanlagen': { en: 'garden-landscaping', it: 'giardino-esterni', fr: 'jardin-exterieurs' },
  'barrierefreiheit': { en: 'accessibility', it: 'accessibilita', fr: 'accessibilite' },
  'fenstertechnik': { en: 'windows', it: 'serramenti', fr: 'fenetres' },
  'rohbau-abbruch': { en: 'shell-demolition', it: 'struttura-demolizione', fr: 'gros-oeuvre-demolition' },
  'tueren-zargen': { en: 'doors-frames', it: 'porte-telai', fr: 'portes-huisseries' },
  'sanitaerinstallation': { en: 'plumbing', it: 'impianto-idraulico', fr: 'plomberie' },
  'zaeune': { en: 'fences', it: 'recinzioni', fr: 'clotures' },
  'komplett-pakete': { en: 'complete-packages', it: 'pacchetti-completi', fr: 'forfaits-complets' },
  'projekte': { en: 'projects', it: 'progetti', fr: 'projets' },
  'projekte/:slug': { en: 'projects/:slug', it: 'progetti/:slug', fr: 'projets/:slug' },
  'materialien': { en: 'materials', it: 'materiali', fr: 'materiaux' },
  'blog': { en: 'magazine', it: 'magazine', fr: 'magazine' },
  'blog/:slug': { en: 'magazine/:slug', it: 'magazine/:slug', fr: 'magazine/:slug' },
  'kontakt': { en: 'contact', it: 'contatto', fr: 'contact' },
  'blitz-angebot': { en: 'express-quote', it: 'preventivo-express', fr: 'devis-express' },
  'kalkulator': { en: 'calculator', it: 'calcolatore', fr: 'calculateur' },
  'haus-sanierung': { en: 'house-renovation', it: 'ristrutturazione-casa', fr: 'renovation-maison' },
  'wohnung-sanierung': { en: 'apartment-renovation', it: 'ristrutturazione-appartamento', fr: 'renovation-appartement' },
  'gastronomie-ausbau': { en: 'restaurant-fit-out', it: 'allestimento-ristorazione', fr: 'amenagement-restaurant' },
  'buero-ausbau': { en: 'office-fit-out', it: 'allestimento-ufficio', fr: 'amenagement-bureau' },
  'heizmethoden': { en: 'heating-methods', it: 'metodi-riscaldamento', fr: 'methodes-chauffage' },
  'heizkoerper': { en: 'radiators', it: 'radiatori', fr: 'radiateurs' },
  'heizstraenge': { en: 'heating-risers', it: 'colonne-riscaldamento', fr: 'colonnes-chauffage' },
  'fussbodenheizung': { en: 'underfloor-heating', it: 'riscaldamento-a-pavimento', fr: 'chauffage-au-sol' },
  'waermepumpe': { en: 'heat-pump', it: 'pompa-di-calore', fr: 'pompe-a-chaleur' },
  'gas-heizung': { en: 'gas-heating', it: 'riscaldamento-a-gas', fr: 'chauffage-gaz' },
  'pelletofen': { en: 'pellet-stove', it: 'stufa-a-pellet', fr: 'poele-a-pellets' },
  'saunaofen': { en: 'sauna-heater', it: 'stufa-per-sauna', fr: 'poele-sauna' },
  'impressum': { en: 'imprint', it: 'note-legali', fr: 'mentions-legales' },
  'datenschutz': { en: 'privacy-policy', it: 'privacy', fr: 'confidentialite' },
};

export type RouteKey = string; // canonical German path WITHOUT leading slash ('' === home)

/** All canonical (German) route patterns, including dynamic ones and home (''). */
export const ROUTE_KEYS: RouteKey[] = ['', ...Object.keys(SLUGS)];

// Longest canonical prefixes first so `/projekte/:slug` wins over `/projekte`.
const STATIC_KEYS_BY_LENGTH = Object.keys(SLUGS)
  .filter((k) => !k.includes(':'))
  .sort((a, b) => b.length - a.length);

function splitTrailing(path: string): { base: string; tail: string } {
  // Separate an optional query/hash tail so it survives translation.
  const match = path.match(/^([^?#]*)([?#].*)?$/);
  return { base: match?.[1] ?? path, tail: match?.[2] ?? '' };
}

/** Strip a leading locale prefix (e.g. `/en`, `/fr`); returns the active locale. */
export function localeFromPathname(pathname: string): Locale {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale;
  }
  return DEFAULT_LOCALE;
}

function stripLocalePrefix(pathname: string): { locale: Locale; rest: string } {
  const locale = localeFromPathname(pathname);
  if (locale === 'de') return { locale, rest: pathname };
  const rest = pathname.slice(`/${locale}`.length) || '/';
  return { locale, rest };
}

/**
 * Map any in-app path (expressed with the canonical German slug) to the URL for
 * the given locale. Query/hash and dynamic content tails are preserved.
 */
export function localizedPath(canonical: string, locale: Locale): string {
  // Admin lives outside the localized URL space — never prefix or translate it.
  if (canonical === '/admin' || canonical.startsWith('/admin/')) return canonical;

  // Allow callers to pass an already-localized path defensively.
  const normalizedCanonical = toCanonicalPath(canonical);
  const { base, tail } = splitTrailing(normalizedCanonical);

  if (base === '/' || base === '') {
    return (locale === 'de' ? '/' : `/${locale}`) + tail;
  }

  const segment = base.replace(/^\//, '');

  if (locale === 'de') return `/${segment}${tail}`;

  // Find the longest canonical static prefix that matches this path.
  const key = STATIC_KEYS_BY_LENGTH.find(
    (k) => segment === k || segment.startsWith(`${k}/`),
  );
  if (!key) return `/${locale}/${segment}${tail}`; // unknown path: prefix only

  const localizedSlug = SLUGS[key][locale];
  const remainder = segment.slice(key.length); // includes leading '/' for tails
  return `/${locale}/${localizedSlug}${remainder}${tail}`;
}

/**
 * Reverse of {@link localizedPath}: turn any (possibly localized) pathname back
 * into its canonical German path, so pathname-based logic (nav highlighting,
 * route metadata lookup) keeps working regardless of the active locale.
 */
export function toCanonicalPath(pathname: string): string {
  const { locale, rest } = stripLocalePrefix(pathname);
  if (locale === 'de') return rest;

  const { base, tail } = splitTrailing(rest);
  const segment = base.replace(/^\//, '');
  if (segment === '') return `/${tail}`;

  // Find the localized slug that matches and swap it back to German.
  for (const key of Object.keys(SLUGS)) {
    if (key.includes(':')) continue;
    const localized = SLUGS[key][locale];
    if (segment === localized || segment.startsWith(`${localized}/`)) {
      const remainder = segment.slice(localized.length);
      return `/${key}${remainder}${tail}`;
    }
  }
  return `/${segment}${tail}`;
}

/** Route path pattern (with `:param`) for React Router, per locale. */
export function routePattern(canonicalKey: RouteKey, locale: Locale): string {
  if (canonicalKey === '') return locale === 'de' ? '/' : `/${locale}`;
  if (locale === 'de') return `/${canonicalKey}`;
  return `/${locale}/${SLUGS[canonicalKey][locale]}`;
}

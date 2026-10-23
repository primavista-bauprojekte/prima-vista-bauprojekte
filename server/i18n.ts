/**
 * Standalone, dependency-free server translation module for the customer-facing
 * outbound text (Resend confirmation emails + the generated calculator PDF).
 *
 * The server does NOT use i18next — this is a small, flat, typed translation
 * map plus a couple of helpers. The default locale is `de`; every locale uses
 * the same typed keys so customer-facing email and PDF wording stays aligned.
 *
 * Scope reminder: only CUSTOMER-facing output is localized. The internal office
 * notification emails stay German and do not use this module.
 *
 * The `Locale` type is defined locally (not imported from `src/i18n/routes`)
 * because the server tsconfig (`tsconfig.node.json`) only includes
 * `server/**` + `netlify/functions/**`, so reaching into `src` would pull a
 * file outside the project graph. The union is kept in sync with that source.
 */

export type Locale = 'de' | 'en' | 'it' | 'fr';

const LOCALES: readonly Locale[] = ['de', 'en', 'it', 'fr'];
const DEFAULT_LOCALE: Locale = 'de';

/** Coerce any untrusted input into a known Locale, defaulting to `de`. */
export function normalizeLocale(input: unknown): Locale {
  return typeof input === 'string' && (LOCALES as readonly string[]).includes(input)
    ? (input as Locale)
    : DEFAULT_LOCALE;
}

const LOCALE_TO_BCP47: Record<Locale, string> = {
  de: 'de-DE',
  en: 'en-US',
  it: 'it-IT',
  fr: 'fr-FR',
};

// ----- Locale-aware formatters (mirror the originals, parameterized) -----

/** Currency, no decimals (mail.ts behaviour). */
export function formatEuro(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Currency with optional cents (calculatorPdf.ts behaviour, uses '-' fallback). */
export function formatEuroPdf(value: number, locale: Locale, cents = true): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/** Plain number formatted for the locale. */
export function formatNumber(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(LOCALE_TO_BCP47[locale]);
}

/** "80 m²" / "12 Stk." — quantity + unit, with a localized default unit. */
export function formatQuantity(quantity: number, unit: string, locale: Locale, dash = '—'): string {
  if (!Number.isFinite(quantity)) return dash;
  const amount = Number.isInteger(quantity)
    ? quantity.toLocaleString(LOCALE_TO_BCP47[locale])
    : quantity.toLocaleString(LOCALE_TO_BCP47[locale], { maximumFractionDigits: 2 });
  return `${amount} ${unit || tt(locale, 'unitFallback')}`.trim();
}

// ----- Template interpolation -----

/** Replace `{placeholder}` tokens in a template with the matching var. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

// ----- Code → label maps (canonical German codes/values → localized label) -----

type CodeLabelMap = Record<Locale, Record<string, string>>;

// Blitz `art` codes (BlitzFormState['art']).
const BLITZ_ART_LABELS: CodeLabelMap = {
  de: {
    pakete: 'Komplettpakete',
    gewerke: 'Gewerke',
    heizung: 'Heizmethoden',
    anderes: 'Anderes',
  },
  en: {
    pakete: 'Complete packages',
    gewerke: 'Trades',
    heizung: 'Heating methods',
    anderes: 'Other',
  },
  it: {
    pakete: 'Pacchetti completi',
    gewerke: 'Lavorazioni',
    heizung: 'Metodi di riscaldamento',
    anderes: 'Altro',
  },
  fr: {
    pakete: 'Forfaits complets',
    gewerke: 'Corps de métier',
    heizung: 'Méthodes de chauffage',
    anderes: 'Autre',
  },
};

// Blitz `starttermin` codes.
const STARTTERMIN_LABELS: CodeLabelMap = {
  de: {
    sofort: 'So schnell wie möglich',
    '1-3m': 'In 1–3 Monaten',
    '3-6m': 'In 3–6 Monaten',
    spaeter: 'Noch unklar / Nächstes Jahr',
  },
  en: {
    sofort: 'As soon as possible',
    '1-3m': 'In 1 – 3 months',
    '3-6m': 'In 3 – 6 months',
    spaeter: 'Not yet decided / next year',
  },
  it: {
    sofort: 'Il prima possibile',
    '1-3m': 'Tra 1 – 3 mesi',
    '3-6m': 'Tra 3 – 6 mesi',
    spaeter: 'Ancora da definire / il prossimo anno',
  },
  fr: {
    sofort: 'Dès que possible',
    '1-3m': 'Dans 1 à 3 mois',
    '3-6m': 'Dans 3 à 6 mois',
    spaeter: 'Encore incertain / l’an prochain',
  },
};

// Kontakt `art` codes (ContactFormState['art']). The German labels mirror the
// CONTACT_ART_OPTIONS in src/data/kontakt.ts.
const KONTAKT_ART_LABELS: CodeLabelMap = {
  de: {
    haus: 'Haussanierung',
    wohnung: 'Wohnung',
    gastro: 'Gastronomie',
    buero: 'Büro',
    einzel: 'Einzelgewerk',
    andere: 'Andere',
  },
  en: {
    haus: 'House renovation',
    wohnung: 'Apartment',
    gastro: 'Restaurant',
    buero: 'Office',
    einzel: 'Single trade',
    andere: 'Other',
  },
  it: {
    haus: 'Ristrutturazione casa',
    wohnung: 'Appartamento',
    gastro: 'Ristorazione',
    buero: 'Ufficio',
    einzel: 'Singola lavorazione',
    andere: 'Altro',
  },
  fr: {
    haus: 'Rénovation de maison',
    wohnung: 'Appartement',
    gastro: 'Restauration',
    buero: 'Bureau',
    einzel: 'Corps de métier unique',
    andere: 'Autre',
  },
};

// Kontakt `region` — POSTed as a canonical German string value.
const REGION_LABELS: CodeLabelMap = {
  de: {
    Deutschland: 'Deutschland',
    Schweiz: 'Schweiz',
    Außerhalb: 'Außerhalb',
  },
  en: {
    Deutschland: 'Germany',
    Schweiz: 'Switzerland',
    Außerhalb: 'Elsewhere',
  },
  it: {
    Deutschland: 'Germania',
    Schweiz: 'Svizzera',
    Außerhalb: 'Altrove',
  },
  fr: {
    Deutschland: 'Allemagne',
    Schweiz: 'Suisse',
    Außerhalb: 'Ailleurs',
  },
};

// Kontakt `budget` — POSTed as a canonical German string value.
const BUDGET_LABELS: CodeLabelMap = {
  de: {
    'Bitte wählen': 'Bitte wählen',
    'Unter € 50.000': 'Unter € 50.000',
    '€ 50.000 – € 150.000': '€ 50.000 – € 150.000',
    '€ 150.000 – € 500.000': '€ 150.000 – € 500.000',
    'Über € 500.000': 'Über € 500.000',
  },
  en: {
    'Bitte wählen': 'Please select',
    'Unter € 50.000': 'Under € 50,000',
    '€ 50.000 – € 150.000': '€ 50,000 – € 150,000',
    '€ 150.000 – € 500.000': '€ 150,000 – € 500,000',
    'Über € 500.000': 'Over € 500,000',
  },
  it: {
    'Bitte wählen': 'Da selezionare',
    'Unter € 50.000': 'Sotto € 50.000',
    '€ 50.000 – € 150.000': '€ 50.000 – € 150.000',
    '€ 150.000 – € 500.000': '€ 150.000 – € 500.000',
    'Über € 500.000': 'Oltre € 500.000',
  },
  fr: {
    'Bitte wählen': 'À sélectionner',
    'Unter € 50.000': 'Moins de € 50.000',
    '€ 50.000 – € 150.000': '€ 50.000 – € 150.000',
    '€ 150.000 – € 500.000': '€ 150.000 – € 500.000',
    'Über € 500.000': 'Plus de € 500.000',
  },
};

// Blitz `gewerke[]` options (BLITZ_SERVICE_GROUPS) — POSTed as canonical German
// strings; only the display in the customer email is localized.
const GEWERKE_LABELS: CodeLabelMap = {
  de: {
    'Haussanierung': 'Haussanierung',
    'Wohnungssanierung': 'Wohnungssanierung',
    'Gastronomieausbau': 'Gastronomieausbau',
    'Büroausbau': 'Büroausbau',
    'Bäder & Sanitär': 'Bäder & Sanitär',
    'Küchen & Möbelbau': 'Küchen & Möbelbau',
    'Böden & Beläge': 'Böden & Beläge',
    Elektroinstallation: 'Elektroinstallation',
    Sanitärinstallation: 'Sanitärinstallation',
    Trockenbau: 'Trockenbau',
    'Maler & Lackierer': 'Maler & Lackierer',
    Fassadensanierung: 'Fassadensanierung',
    Dachsanierung: 'Dachsanierung',
    'Abdichtung & Keller': 'Abdichtung & Keller',
    'Treppen & Geländer': 'Treppen & Geländer',
    'Garten & Außenanlagen': 'Garten & Außenanlagen',
    Barrierefreiheit: 'Barrierefreiheit',
    Fenstertechnik: 'Fenstertechnik',
    'Rohbau & Abbruch': 'Rohbau & Abbruch',
    'Türen & Zargen': 'Türen & Zargen',
    'Zäune & Tore': 'Zäune & Tore',
    Heizkörper: 'Heizkörper',
    Heizstränge: 'Heizstränge',
    'Fußbodenheizung': 'Fußbodenheizung',
    'Luftwärmepumpe': 'Luftwärmepumpe',
    'Gasheizung': 'Gasheizung',
    Pelletofen: 'Pelletofen',
    Saunaofen: 'Saunaofen',
  },
  en: {
    'Haussanierung': 'House renovation',
    'Wohnungssanierung': 'Apartment renovation',
    'Gastronomieausbau': 'Restaurant fit-out',
    'Büroausbau': 'Office fit-out',
    'Bäder & Sanitär': 'Bathrooms & plumbing',
    'Küchen & Möbelbau': 'Kitchens & cabinetry',
    'Böden & Beläge': 'Floors & coverings',
    Elektroinstallation: 'Electrical installation',
    Sanitärinstallation: 'Plumbing installation',
    Trockenbau: 'Drywall',
    'Maler & Lackierer': 'Painting & decorating',
    Fassadensanierung: 'Facade renovation',
    Dachsanierung: 'Roof renovation',
    'Abdichtung & Keller': 'Waterproofing & basement',
    'Treppen & Geländer': 'Stairs & railings',
    'Garten & Außenanlagen': 'Garden & landscaping',
    Barrierefreiheit: 'Accessibility',
    Fenstertechnik: 'Windows',
    'Rohbau & Abbruch': 'Shell & demolition',
    'Türen & Zargen': 'Doors & frames',
    'Zäune & Tore': 'Fences & gates',
    Heizkörper: 'Radiators',
    Heizstränge: 'Heating risers',
    'Fußbodenheizung': 'Underfloor heating',
    'Luftwärmepumpe': 'Air-source heat pump',
    'Gasheizung': 'Gas heating',
    Pelletofen: 'Pellet stove',
    Saunaofen: 'Sauna heater',
  },
  it: {
    'Haussanierung': 'Ristrutturazione casa',
    'Wohnungssanierung': 'Ristrutturazione appartamento',
    'Gastronomieausbau': 'Allestimento ristorazione',
    'Büroausbau': 'Allestimento ufficio',
    'Bäder & Sanitär': 'Bagni & impianti sanitari',
    'Küchen & Möbelbau': 'Cucine & mobili',
    'Böden & Beläge': 'Pavimenti & rivestimenti',
    Elektroinstallation: 'Impianto elettrico',
    Sanitärinstallation: 'Impianto idraulico',
    Trockenbau: 'Cartongesso',
    'Maler & Lackierer': 'Pittura & verniciatura',
    Fassadensanierung: 'Ristrutturazione facciata',
    Dachsanierung: 'Ristrutturazione tetto',
    'Abdichtung & Keller': 'Impermeabilizzazione & cantina',
    'Treppen & Geländer': 'Scale & ringhiere',
    'Garten & Außenanlagen': 'Giardino & esterni',
    Barrierefreiheit: 'Accessibilità',
    Fenstertechnik: 'Serramenti',
    'Rohbau & Abbruch': 'Struttura & demolizione',
    'Türen & Zargen': 'Porte & telai',
    'Zäune & Tore': 'Recinzioni & cancelli',
    Heizkörper: 'Radiatori',
    Heizstränge: 'Colonne di riscaldamento',
    'Fußbodenheizung': 'Riscaldamento a pavimento',
    'Luftwärmepumpe': 'Pompa di calore ad aria',
    'Gasheizung': 'Riscaldamento a gas',
    Pelletofen: 'Stufa a pellet',
    Saunaofen: 'Stufa per sauna',
  },
  fr: {
    'Haussanierung': 'Rénovation de maison',
    'Wohnungssanierung': 'Rénovation d’appartement',
    'Gastronomieausbau': 'Aménagement de restauration',
    'Büroausbau': 'Aménagement de bureau',
    'Bäder & Sanitär': 'Salles de bains & sanitaires',
    'Küchen & Möbelbau': 'Cuisines & agencement',
    'Böden & Beläge': 'Sols & revêtements',
    Elektroinstallation: 'Installation électrique',
    Sanitärinstallation: 'Installation sanitaire',
    Trockenbau: 'Cloisons sèches',
    'Maler & Lackierer': 'Peinture & laquage',
    Fassadensanierung: 'Rénovation de façade',
    Dachsanierung: 'Rénovation de toiture',
    'Abdichtung & Keller': 'Étanchéité & sous-sol',
    'Treppen & Geländer': 'Escaliers & garde-corps',
    'Garten & Außenanlagen': 'Jardin & aménagements extérieurs',
    Barrierefreiheit: 'Accessibilité',
    Fenstertechnik: 'Fenêtres',
    'Rohbau & Abbruch': 'Gros œuvre & démolition',
    'Türen & Zargen': 'Portes & huisseries',
    'Zäune & Tore': 'Clôtures & portails',
    Heizkörper: 'Radiateurs',
    Heizstränge: 'Colonnes de chauffage',
    'Fußbodenheizung': 'Chauffage au sol',
    'Luftwärmepumpe': 'Pompe à chaleur air',
    'Gasheizung': 'Chauffage au gaz',
    Pelletofen: 'Poêle à granulés',
    Saunaofen: 'Poêle de sauna',
  },
};

const TERMIN_ART_LABELS: CodeLabelMap = {
  de: { 'vor-ort': 'Vor Ort', video: 'Video' },
  en: { 'vor-ort': 'On site', video: 'Video' },
  it: { 'vor-ort': 'In loco', video: 'Video' },
  fr: { 'vor-ort': 'Sur place', video: 'Visio' },
};

/** "Fr., 24. Juli 2026" — localized long date for an ISO yyyy-mm-dd string. */
export function formatDateLong(dateStr: string, locale: Locale): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale], {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Look up a canonical code/value in a code→label map, falling back to the raw
 *  code when there is no mapping (so an unknown value still renders something). */
function labelFrom(map: CodeLabelMap, locale: Locale, code: string): string {
  return map[locale][code] ?? map[DEFAULT_LOCALE][code] ?? code;
}

export const artLabel = (locale: Locale, code: string) => labelFrom(BLITZ_ART_LABELS, locale, code);
export const starterminLabel = (locale: Locale, code: string) => labelFrom(STARTTERMIN_LABELS, locale, code);
export const kontaktArtLabel = (locale: Locale, code: string) => labelFrom(KONTAKT_ART_LABELS, locale, code);
export const regionLabel = (locale: Locale, code: string) => labelFrom(REGION_LABELS, locale, code);
export const budgetLabel = (locale: Locale, code: string) => labelFrom(BUDGET_LABELS, locale, code);
const LEGACY_GEWERKE_CODES: Record<string, string> = {
  'Haus-Sanierung': 'Haussanierung',
  'Wohnung-Sanierung': 'Wohnungssanierung',
  'Gastronomie-Ausbau': 'Gastronomieausbau',
  'Büro-Ausbau': 'Büroausbau',
  'Fußboden-Heizung': 'Fußbodenheizung',
  'Luft-Wärmepumpe': 'Luftwärmepumpe',
  'Gas-Heizung': 'Gasheizung',
};
export const gewerkeLabel = (locale: Locale, code: string) =>
  labelFrom(GEWERKE_LABELS, locale, LEGACY_GEWERKE_CODES[code] ?? code);
export const terminArtLabel = (locale: Locale, code: string) => labelFrom(TERMIN_ART_LABELS, locale, code);

// ----- Flat customer-facing string catalogue -----
//
// Keys cover every customer-facing literal from mail.ts (kontakt + blitz
// confirmations, the calculator-PDF covering email) and calculatorPdf.ts. The
// German values are copied verbatim from the original source. Use `{token}` for
// runtime interpolation via `interpolate`.

const STRINGS = {
  de: {
    // --- shared ---
    signature: 'Mit freundlichen Grüßen,\nDaniel & Monica Irimia · Prima Vista Bauprojekte',
    signatureLine1: 'Mit freundlichen Grüßen,',
    signatureName: 'Daniel & Monica Irimia',
    company: 'Prima Vista Bauprojekte',
    unitFallback: 'Stk.',
    scopeArea: 'Fläche',
    scopeExtent: 'Umfang',
    scopeAreaOrExtent: 'Fläche / Umfang',
    nextSteps: 'So geht es weiter',

    // --- kontakt customer confirmation ---
    kontaktSubject: 'Vielen Dank für Ihre Anfrage — Prima Vista Bauprojekte',
    kontaktTitle: 'Vielen Dank, {name}.',
    kontaktEyebrow: 'Eingangsbestätigung · Kontaktanfrage',
    kontaktIntro: 'Ihre Anfrage ist bei uns eingegangen. Wir prüfen Ihr Vorhaben und melden uns innerhalb von 24 Stunden bei Ihnen — per E-Mail an {email}{phone}.',
    kontaktIntroText: 'Ihre Anfrage ist bei uns eingegangen. Wir melden uns innerhalb von 24 Stunden bei Ihnen — per E-Mail an {email}{phone}.',
    kontaktPhoneSuffix: ' oder telefonisch unter {tel}',
    kontaktRowEmail: 'Ihre E-Mail',
    kontaktRowTel: 'Telefon',
    kontaktRowArt: 'Art',
    kontaktStep1: 'Wir lesen Ihre Angaben und bereiten erste Fragen vor.',
    kontaktStep2: 'Sie erhalten eine schriftliche Antwort oder einen Rückruf.',
    kontaktStep3: 'Auf Wunsch vereinbaren wir einen Termin vor Ort.',
    kontaktRowWunschtermin: 'Wunschtermin',
    kontaktRowZeitfenster: 'Uhrzeit',
    kontaktRowTerminart: 'Terminart',
    kontaktRowAlternativ: 'Alternativtermin',
    kontaktTerminNote: 'Ihr genauer Wunschtermin ist im Kalender vorgemerkt — verbindlich wird er erst mit unserer Bestätigung innerhalb von 48 Stunden.',

    // --- blitz customer confirmation ---
    blitzSubject: 'Ihre Blitzanfrage ist eingegangen — Prima Vista Bauprojekte',
    blitzTitle: 'Vielen Dank, {name}.',
    blitzEyebrow: 'Eingangsbestätigung · Blitzangebot',
    blitzIntro: 'Ihre Blitzanfrage ist bei uns eingegangen. Wir werten Ihr Projekt aus und senden Ihnen innerhalb von 24 Stunden eine erste Kostenschätzung per E-Mail an {email}{phone}.',
    blitzIntroText: 'Ihre Blitzanfrage ist bei uns eingegangen. Sie erhalten innerhalb von 24 Stunden eine erste Kostenschätzung per E-Mail an {email}{phone}.',
    blitzYourDetails: 'Ihre Angaben',
    blitzYourServices: 'Ihre ausgewählten Leistungen',
    blitzYourNote: 'Ihre Notiz',
    blitzCalcHeading: 'Ihre übernommene Kalkulation',
    blitzStep1: 'Die Bauleitung prüft Fläche bzw. Umfang, Standort und gewünschte Leistungen.',
    blitzStep2: 'Sie erhalten eine schriftliche Kostenschätzung.',
    blitzStep3: 'Auf Wunsch verfeinern wir das Angebot vor Ort. Verbindlich wird der Preis nach dem Aufmaß.',
    blitzStep3Text: 'Auf Wunsch verfeinern wir das Angebot vor Ort.',

    // --- blitz automatic estimate (customer) ---
    blitzAutoSubject: 'Ihre vorläufige Kostenschätzung mit Detail-PDF — Prima Vista Bauprojekte',
    blitzAutoTitle: 'Ihre vorläufige Kostenschätzung, {name}.',
    blitzAutoEyebrow: 'Kostenschätzung · Blitzangebot',
    blitzAutoIntro: 'Vielen Dank für Ihre Anfrage. Wir haben die Standardberechnung unseres Online-Kalkulators auf Ihre angegebene Projektgröße angewendet und daraus Ihre vorläufige Kostenschätzung erstellt.',
    blitzAutoRangeLabel: 'Geschätzte Investition',
    blitzAutoRangeNote: 'Alle Beträge netto zzgl. gesetzlicher MwSt.',
    blitzAutoAssumptions: 'Annahmen & Hinweise',
    blitzAutoAssumption1: 'Kalkuliert mit der Standardkonfiguration des Online-Kalkulators, skaliert auf Ihre angegebene Projektgröße und bei üblicher Bestandssituation.',
    blitzAutoAssumption2: 'Nicht enthalten: Sonderlösungen wie statische Eingriffe, Schadstoffsanierung oder Auflagen des Denkmalschutzes.',
    blitzAutoAssumption3: 'Die Spanne deckt typische Ausstattungs- und Gebäudevarianten ab; Ihr konkretes Projekt kann davon abweichen.',
    blitzAutoDisclaimer: 'Diese Kostenschätzung ist kein verbindliches Angebot. Verbindliche Preise entstehen nach Besichtigung, Aufmaß und Materialbemusterung und werden von unserer Bauleitung geprüft und gegengezeichnet.',
    blitzAutoPdfNote: 'Im Anhang finden Sie die detaillierte PDF-Aufstellung dieser Standardberechnung — Position für Position und passend zu Ihrer angegebenen Projektgröße.',
    blitzAutoStep1: 'Antworten Sie auf diese E-Mail oder vereinbaren Sie direkt einen Termin — unsere Bauleitung prüft Ihr Projekt persönlich.',
    blitzAutoStep2: 'Vor-Ort-Besichtigung und Aufmaß durch Daniel oder Monica.',
    blitzAutoStep3: 'Sie erhalten Ihr verbindliches Festpreisangebot — schwarz auf weiß.',

    // blitz project rows / calculator summary (customer)
    rowRequest: 'Anfrage',
    rowRequestValue: 'Aus dem Kalkulator übernommen',
    rowCalculator: 'Rechner',
    rowEstimate: 'Kostenschätzung',
    rowStart: 'Baubeginn',
    rowObjectType: 'Objektart',
    rowMid: 'Mittelwert',
    rowGuideValue: 'Richtwert',
    calcFromCalculator: 'Aus dem Kalkulator übernommen',
    calcChosenServices: 'Gewählte Leistungen:',
    emptyPreselection: 'Noch keine Vorauswahl',
    calcColPosition: 'Position',
    calcColQuantity: 'Menge',
    calcColTotal: 'Summe',
    calcNPositions: '{n} Positionen',

    // --- calculator-pdf covering email ---
    pdfMailSubject: 'Ihre PDF-Aufstellung · {kind}',
    pdfMailTitle: 'Ihre PDF-Aufstellung ist da.',
    pdfMailEyebrow: 'Kalkulator · PDF-Aufstellung',
    pdfMailIntro: 'Im Anhang finden Sie Ihre PDF-Aufstellung aus dem Prima Vista Kalkulator für {kind}. Alle Summen, Positionen und Hinweise sind dort kompakt zusammengefasst.',
    pdfMailIntroText1: 'Im Anhang finden Sie Ihre PDF-Aufstellung aus dem Prima Vista Kalkulator für {kind}.',
    pdfMailIntroText2: 'Alle Summen, Positionen und Hinweise sind dort kompakt zusammengefasst.',
    pdfMailStep1: 'Öffnen Sie die PDF im Anhang für die vollständige Aufstellung.',
    pdfMailStep2: 'Für ein verbindliches Angebot prüfen wir Aufmaß, Bestand und Materialauswahl.',
    pdfMailStep3: 'Antworten Sie direkt auf diese E-Mail, wenn wir die Schätzung verfeinern sollen.',

    // --- PDF document (calculatorPdf.ts) ---
    pdfDocTitle: 'Prima Vista Kostenvoranschlag - {kind}',
    pdfDocSubject: 'Kostenschätzung aus dem Kalkulator',
    pdfHeaderTagline: 'SANIERUNG & BAU · KOSTENSCHÄTZUNG',
    pdfBandTagline: 'SANIERUNG & BAU · AUFTRAGSUNTERLAGEN',
    pdfTitleEstimate: 'Kostenvoranschlag',
    pdfTitleProductDetails: 'Produktdetails',

    pdfAddrFirma: 'Firma',
    pdfAddrName: 'Vor- und Nachname',
    pdfAddrStreet: 'Straße',
    pdfAddrZipCity: 'PLZ und Ort',
    pdfAddrState: 'Bundesland',
    pdfAddrCountry: 'Land',
    pdfAddrTaxId: 'USt-IdNr. / Steuernummer',

    pdfProjectDataTitle: 'Projekt- und Rechnungsdaten',
    pdfProjectDataIntro: 'Bitte bei Auftragserteilung ausfüllen. Die Kalkulator-Auswahl bleibt im Anhang nachvollziehbar.',
    pdfLinkLabel: 'Link zur Kalkulator-Auswahl:',
    pdfBillingAddress: 'Rechnungsanschrift',
    pdfProjectAddress: 'Projekt-/Lieferanschrift',
    pdfAddressHint: 'Hinweis: Wenn Rechnungs- und Projektanschrift identisch sind, genügt ein Eintrag links. Abweichende Liefer- oder Baustellenadressen bitte rechts ergänzen.',

    pdfFooterOfficeTitle: 'Geschäftssitz',
    pdfFooterContactTitle: 'Kontakt',
    pdfFooterLegalTitle: 'Rechtliches',
    pdfFooterSwitzerlandTitle: 'Schweiz',
    pdfFooterPage: 'Seite {n} / {total}',
    contactPrimaryLabel: 'Hauptkontakt',
    contactSecondaryLabel: 'Alternativer Kontakt (Sonja)',
    pdfFooterEmail: 'E-Mail: office@primavista-bauprojekte.com',
    pdfFooterTaxNr: 'Steuernr.: 01483039527',
    pdfFooterVatId: 'USt-IdNr.: DE 358812805',
    pdfFooterCourt: 'Amtsgericht Frankfurt am Main',

    pdfSummaryEyebrow: 'AUS DEM KALKULATOR',
    pdfSummaryTotal: 'GESAMTSUMME',
    pdfSummaryNet: 'Netto {value}',
    pdfSummaryVat: 'zzgl. 19 % MwSt. {value}',
    pdfSummaryScope: '{label}: {value}',
    pdfSummaryEstimate: 'Kostenschätzung: {min} – {max}',
    pdfSummaryGuide: 'Richtwert: {value} / m²',

    pdfTableProduct: 'Produkt / Leistung',
    pdfTableCount: 'Anzahl',
    pdfTableUnitPrice: 'Stückpreis netto',
    pdfTableTotalNet: 'Gesamt netto',

    pdfPositionsTitle: 'Aufstellung der ausgewählten Positionen',
    pdfNoPositions: 'Keine aktiven Positionen ausgewählt.',

    pdfTotalNetSum: 'Gesamtnettosumme',
    pdfTotalVat: 'zzgl. 19 % MwSt.',
    pdfTotalGross: 'Gesamtsumme',
    pdfDisclaimer: 'Diese Kostenschätzung basiert auf den im Online-Kalkulator ausgewählten Positionen. Verbindliche Preise entstehen nach Aufmaß, Prüfung der baulichen Situation und Materialbemusterung.',

    pdfProductDetailsIntro: 'Details zu den ausgewählten Positionen aus dem Kalkulator. Mengen, Ausführung und Materialauswahl werden vor Ort geprüft und im finalen Angebot bestätigt.',
    pdfProductProdNr: 'Prod.-Nr.: {sku}',
    pdfProductType: 'Art: {type}',
    pdfProductQuantity: 'Menge: {value}',
    pdfProductUnitPrice: 'Stückpreis netto: {value}',
    pdfProductTotalNet: 'Gesamt netto: {value}',
    pdfProductGenericDescription: '{label} ist Teil der ausgewählten Kalkulation im Bereich {category}. Menge, Ausführung und Materialauswahl werden vor Ort geprüft und im finalen Angebot bestätigt.',

    pdfSignTitle: 'Auftragserteilung und Bestätigungen',
    pdfSignIntro: 'Diese Seite ist für die spätere Beauftragung vorgesehen. Die PDF-Aufstellung ist eine vorläufige Kostenschätzung. Verbindlich wird der Auftrag erst nach Aufmaß, finalem Angebot und Unterschrift.',
    pdfSignCard1Title: 'Auftrag nach finalem Angebot',
    pdfSignCard1Body: 'Ich beauftrage Prima Vista Bauprojekte auf Basis des finalisierten Angebots und des gemeinsam abgestimmten Ausführungszeitpunkts.',
    pdfSignCard2Title: 'Vertragsbedingungen gelesen',
    pdfSignCard2Body: 'Ich bestätige, die Allgemeinen Geschäftsbedingungen und Vertragsbedingungen erhalten, gelesen und akzeptiert zu haben.',
    pdfSignCard3Title: 'Leistungsumfang und Materialbasis',
    pdfSignCard3Body: 'Die aufgeführten Leistungen, Mengen und Materialien bilden die Grundlage für Prüfung, Planung und Angebot. Änderungen werden gesondert ausgewiesen.',
    pdfSignCard4Title: 'Widerruf und Rücktritt',
    pdfSignCard4Body: 'Ich bestätige, die Widerrufsbelehrung bzw. Rücktrittsinformation inklusive Formular erhalten und gelesen zu haben, soweit diese Anwendung findet.',
    pdfSignConfirmed: 'bestätigt',
    pdfSignFinalTitle: 'Abschluss der Auftragserteilung',
    pdfSignFinalBody: 'Mit Datum und Unterschrift werden die oben genannten Bestätigungen zusammen bestätigt.',
    pdfSignDatePlace: 'Datum, Ort',
    pdfSignSignature: 'Unterschrift Auftraggeber/in',

    pdfScopeDefault: 'Umfang',
  },

  en: {
    // --- shared ---
    signature: 'Kind regards,\nDaniel & Monica Irimia · Prima Vista Bauprojekte',
    signatureLine1: 'Kind regards,',
    signatureName: 'Daniel & Monica Irimia',
    company: 'Prima Vista Bauprojekte',
    unitFallback: 'pcs.',
    scopeArea: 'Area',
    scopeExtent: 'Scope',
    scopeAreaOrExtent: 'Area / scope',
    nextSteps: 'What happens next',

    // --- kontakt customer confirmation ---
    kontaktSubject: 'Thank you for your enquiry — Prima Vista Bauprojekte',
    kontaktTitle: 'Thank you, {name}.',
    kontaktEyebrow: 'Confirmation of receipt · Contact enquiry',
    kontaktIntro: 'We have received your enquiry. We will review your project and get back to you within 24 hours — by email to {email}{phone}.',
    kontaktIntroText: 'We have received your enquiry. We will get back to you within 24 hours — by email to {email}{phone}.',
    kontaktPhoneSuffix: ' or by phone on {tel}',
    kontaktRowEmail: 'Your email',
    kontaktRowTel: 'Phone',
    kontaktRowArt: 'Type',
    kontaktStep1: 'We review your details and prepare initial questions.',
    kontaktStep2: 'You receive a written reply or a call back.',
    kontaktStep3: 'On request, we arrange an on-site appointment.',
    kontaktRowWunschtermin: 'Preferred date',
    kontaktRowZeitfenster: 'Exact time',
    kontaktRowTerminart: 'Appointment type',
    kontaktRowAlternativ: 'Alternative date',
    kontaktTerminNote: 'Your exact preferred time is reserved in the calendar — it only becomes binding once we confirm it within 48 hours.',

    // --- blitz customer confirmation ---
    blitzSubject: 'We have received your express quote request — Prima Vista Bauprojekte',
    blitzTitle: 'Thank you, {name}.',
    blitzEyebrow: 'Confirmation of receipt · Express quote',
    blitzIntro: 'We have received your express quote request. We will assess your project and send you an initial cost estimate within 24 hours — by email to {email}{phone}.',
    blitzIntroText: 'We have received your express quote request. You will receive an initial cost estimate within 24 hours by email to {email}{phone}.',
    blitzYourDetails: 'Your details',
    blitzYourServices: 'Your selected services',
    blitzYourNote: 'Your note',
    blitzCalcHeading: 'Your transferred calculation',
    blitzStep1: 'Our site management reviews the area or scope, location and requested services.',
    blitzStep2: 'You receive a written preliminary cost estimate.',
    blitzStep3: 'On request, we refine the quote on site — binding after measurement.',
    blitzStep3Text: 'On request, we refine the quote on site.',

    // --- blitz automatic estimate (customer) ---
    blitzAutoSubject: 'Your preliminary cost estimate with detailed PDF — Prima Vista Bauprojekte',
    blitzAutoTitle: 'Your preliminary cost estimate, {name}.',
    blitzAutoEyebrow: 'Preliminary cost estimate · Express quote',
    blitzAutoIntro: 'Thank you for your enquiry. We applied our online calculator’s standard calculation to your stated project size and used it to prepare your preliminary cost estimate.',
    blitzAutoRangeLabel: 'Estimated investment',
    blitzAutoRangeNote: 'All amounts net, plus statutory VAT.',
    blitzAutoAssumptions: 'Assumptions & notes',
    blitzAutoAssumption1: 'Calculated with the online calculator’s standard configuration, scaled to your stated project size and assuming a typical existing structure.',
    blitzAutoAssumption2: 'Not included: special measures such as structural interventions, hazardous-material remediation or heritage-protection requirements.',
    blitzAutoAssumption3: 'The range covers typical fit-out and building variants; your specific project may differ.',
    blitzAutoDisclaimer: 'This preliminary estimate is not a binding quote. Binding prices are determined after a site visit, measurement and material sampling — reviewed and countersigned by our site management.',
    blitzAutoPdfNote: 'The attached detailed PDF shows this standard calculation item by item, scaled to your stated project size.',
    blitzAutoStep1: 'Reply to this email or book an appointment right away — our site management reviews your project personally.',
    blitzAutoStep2: 'On-site visit and measurement by Daniel or Monica.',
    blitzAutoStep3: 'You receive your binding fixed-price quote — in black and white.',

    // blitz project rows / calculator summary (customer)
    rowRequest: 'Request',
    rowRequestValue: 'Transferred from the calculator',
    rowCalculator: 'Calculator',
    rowEstimate: 'Preliminary estimate',
    rowStart: 'Start of work',
    rowObjectType: 'Property type',
    rowMid: 'Average',
    rowGuideValue: 'Guide value',
    calcFromCalculator: 'Transferred from the calculator',
    calcChosenServices: 'Selected services:',
    emptyPreselection: 'No pre-selection yet',
    calcColPosition: 'Item',
    calcColQuantity: 'Quantity',
    calcColTotal: 'Total',
    calcNPositions: '{n} items',

    // --- calculator-pdf covering email ---
    pdfMailSubject: 'Your PDF breakdown · {kind}',
    pdfMailTitle: 'Your PDF breakdown is here.',
    pdfMailEyebrow: 'Calculator · PDF breakdown',
    pdfMailIntro: 'Attached you will find your PDF breakdown from the Prima Vista calculator for {kind}. All totals, line items and notes are summarised there in a compact form.',
    pdfMailIntroText1: 'Attached you will find your PDF breakdown from the Prima Vista calculator for {kind}.',
    pdfMailIntroText2: 'All totals, line items and notes are summarised there in a compact form.',
    pdfMailStep1: 'Open the attached PDF for the full breakdown.',
    pdfMailStep2: 'For a binding quote we review the measurements, existing structure and material selection.',
    pdfMailStep3: 'Reply directly to this email if you would like us to refine the estimate.',

    // --- PDF document (calculatorPdf.ts) ---
    pdfDocTitle: 'Prima Vista cost estimate - {kind}',
    pdfDocSubject: 'Preliminary estimate from the calculator',
    pdfHeaderTagline: 'RENOVATION & CONSTRUCTION · PRELIMINARY ESTIMATE',
    pdfBandTagline: 'RENOVATION & CONSTRUCTION · ORDER DOCUMENTS',
    pdfTitleEstimate: 'Cost estimate',
    pdfTitleProductDetails: 'Product details',

    pdfAddrFirma: 'Company',
    pdfAddrName: 'First and last name',
    pdfAddrStreet: 'Street',
    pdfAddrZipCity: 'Postcode and city',
    pdfAddrState: 'Region',
    pdfAddrCountry: 'Country',
    pdfAddrTaxId: 'VAT ID / tax number',

    pdfProjectDataTitle: 'Project and billing details',
    pdfProjectDataIntro: 'Please complete when placing the order. The calculator selection remains traceable in the attachment.',
    pdfLinkLabel: 'Link to the calculator selection:',
    pdfBillingAddress: 'Billing address',
    pdfProjectAddress: 'Project / delivery address',
    pdfAddressHint: 'Note: If the billing and project addresses are identical, a single entry on the left is sufficient. Please add any differing delivery or site addresses on the right.',

    pdfFooterOfficeTitle: 'Registered office',
    pdfFooterContactTitle: 'Contact',
    pdfFooterLegalTitle: 'Legal',
    pdfFooterSwitzerlandTitle: 'Switzerland',
    pdfFooterPage: 'Page {n} / {total}',
    contactPrimaryLabel: 'Primary contact',
    contactSecondaryLabel: 'Alternative contact (Sonja)',
    pdfFooterEmail: 'Email: office@primavista-bauprojekte.com',
    pdfFooterTaxNr: 'Tax no.: 01483039527',
    pdfFooterVatId: 'VAT ID: DE 358812805',
    pdfFooterCourt: 'District Court Frankfurt am Main',

    pdfSummaryEyebrow: 'FROM THE CALCULATOR',
    pdfSummaryTotal: 'TOTAL',
    pdfSummaryNet: 'Net {value}',
    pdfSummaryVat: 'plus 19% VAT {value}',
    pdfSummaryScope: '{label}: {value}',
    pdfSummaryEstimate: 'Preliminary estimate: {min} - {max}',
    pdfSummaryGuide: 'Guide value: {value} / m²',

    pdfTableProduct: 'Product / service',
    pdfTableCount: 'Quantity',
    pdfTableUnitPrice: 'Unit price net',
    pdfTableTotalNet: 'Total net',

    pdfPositionsTitle: 'Breakdown of the selected items',
    pdfNoPositions: 'No active items selected.',

    pdfTotalNetSum: 'Total net',
    pdfTotalVat: 'plus 19% VAT',
    pdfTotalGross: 'Total',
    pdfDisclaimer: 'This preliminary estimate is based on the items selected in the online calculator. Binding prices are determined after measurement, assessment of the structural situation and material sampling.',

    pdfProductDetailsIntro: 'Details of the items selected in the calculator. Quantities, execution and material selection are reviewed on site and confirmed in the final quote.',
    pdfProductProdNr: 'Prod. no.: {sku}',
    pdfProductType: 'Type: {type}',
    pdfProductQuantity: 'Quantity: {value}',
    pdfProductUnitPrice: 'Unit price net: {value}',
    pdfProductTotalNet: 'Total net: {value}',
    pdfProductGenericDescription: '{label} is part of the selected calculation in the {category} area. Quantity, execution and material selection are reviewed on site and confirmed in the final quote.',

    pdfSignTitle: 'Order placement and confirmations',
    pdfSignIntro: 'This page is intended for placing the order at a later stage. The PDF breakdown is a preliminary estimate. The order only becomes binding after measurement, the final quote and signature.',
    pdfSignCard1Title: 'Order after final quote',
    pdfSignCard1Body: 'I commission Prima Vista Bauprojekte on the basis of the finalised quote and the jointly agreed start date.',
    pdfSignCard2Title: 'Terms and conditions read',
    pdfSignCard2Body: 'I confirm that I have received, read and accepted the general terms and conditions and the contract terms.',
    pdfSignCard3Title: 'Scope of services and material basis',
    pdfSignCard3Body: 'The listed services, quantities and materials form the basis for review, planning and quotation. Any changes will be shown separately.',
    pdfSignCard4Title: 'Withdrawal and cancellation',
    pdfSignCard4Body: 'I confirm that I have received and read the cancellation policy and withdrawal information, including the form, where applicable.',
    pdfSignConfirmed: 'confirmed',
    pdfSignFinalTitle: 'Completion of the order',
    pdfSignFinalBody: 'With date and signature, the confirmations listed above are confirmed together.',
    pdfSignDatePlace: 'Date, place',
    pdfSignSignature: 'Signature of the client',

    pdfScopeDefault: 'Scope',
  },

  it: {
    // --- shared ---
    signature: 'Cordiali saluti,\nDaniel & Monica Irimia · Prima Vista Bauprojekte',
    signatureLine1: 'Cordiali saluti,',
    signatureName: 'Daniel & Monica Irimia',
    company: 'Prima Vista Bauprojekte',
    unitFallback: 'pz.',
    scopeArea: 'Superficie',
    scopeExtent: 'Entità',
    scopeAreaOrExtent: 'Superficie / entità',
    nextSteps: 'Come si procede',

    // --- kontakt customer confirmation ---
    kontaktSubject: 'Grazie per la Sua richiesta — Prima Vista Bauprojekte',
    kontaktTitle: 'Grazie, {name}.',
    kontaktEyebrow: 'Conferma di ricezione · Richiesta di contatto',
    kontaktIntro: 'Abbiamo ricevuto la Sua richiesta. Esamineremo il Suo progetto e La ricontatteremo entro 24 ore — via e-mail all’indirizzo {email}{phone}.',
    kontaktIntroText: 'Abbiamo ricevuto la Sua richiesta. La ricontatteremo entro 24 ore — via e-mail all’indirizzo {email}{phone}.',
    kontaktPhoneSuffix: ' o telefonicamente al numero {tel}',
    kontaktRowEmail: 'La Sua e-mail',
    kontaktRowTel: 'Telefono',
    kontaktRowArt: 'Tipo',
    kontaktStep1: 'Esaminiamo i Suoi dati e prepariamo le prime domande.',
    kontaktStep2: 'Riceverà una risposta scritta o una richiamata.',
    kontaktStep3: 'Su richiesta fissiamo un appuntamento in loco.',
    kontaktRowWunschtermin: 'Data preferita',
    kontaktRowZeitfenster: 'Orario esatto',
    kontaktRowTerminart: 'Tipo di appuntamento',
    kontaktRowAlternativ: 'Data alternativa',
    kontaktTerminNote: 'L’orario esatto da Lei preferito è riservato nel calendario — diventa vincolante solo con la nostra conferma entro 48 ore.',

    // --- blitz customer confirmation ---
    blitzSubject: 'Abbiamo ricevuto la Sua richiesta di preventivo express — Prima Vista Bauprojekte',
    blitzTitle: 'Grazie, {name}.',
    blitzEyebrow: 'Conferma di ricezione · Preventivo express',
    blitzIntro: 'Abbiamo ricevuto la Sua richiesta di preventivo express. Valuteremo il Suo progetto e Le invieremo una prima stima dei costi entro 24 ore — via e-mail all’indirizzo {email}{phone}.',
    blitzIntroText: 'Abbiamo ricevuto la Sua richiesta di preventivo express. Riceverà una prima stima dei costi entro 24 ore via e-mail all’indirizzo {email}{phone}.',
    blitzYourDetails: 'I Suoi dati',
    blitzYourServices: 'Le lavorazioni selezionate',
    blitzYourNote: 'La Sua nota',
    blitzCalcHeading: 'Il Suo calcolo importato',
    blitzStep1: 'La direzione lavori verifica superficie o entità, ubicazione e lavorazioni richieste.',
    blitzStep2: 'Riceverà una stima preliminare dei costi per iscritto.',
    blitzStep3: 'Su richiesta affiniamo l’offerta in loco — vincolante dopo il rilievo.',
    blitzStep3Text: 'Su richiesta affiniamo l’offerta in loco.',

    // --- blitz automatic estimate (customer) ---
    blitzAutoSubject: 'La Sua stima preliminare dei costi con PDF dettagliato — Prima Vista Bauprojekte',
    blitzAutoTitle: 'La Sua stima preliminare dei costi, {name}.',
    blitzAutoEyebrow: 'Stima preliminare dei costi · Preventivo express',
    blitzAutoIntro: 'Grazie per la Sua richiesta. Abbiamo applicato il calcolo standard del nostro preventivatore online alle dimensioni del progetto da Lei indicate e abbiamo così elaborato la Sua stima preliminare dei costi.',
    blitzAutoRangeLabel: 'Investimento stimato',
    blitzAutoRangeNote: 'Tutti gli importi netti, più IVA di legge.',
    blitzAutoAssumptions: 'Presupposti e note',
    blitzAutoAssumption1: 'Calcolata con la configurazione standard del preventivatore online, adattata alle dimensioni del progetto da Lei indicate e ipotizzando una situazione edilizia tipica.',
    blitzAutoAssumption2: 'Non incluse: soluzioni speciali come interventi strutturali, bonifica di materiali nocivi o vincoli di tutela dei beni culturali.',
    blitzAutoAssumption3: 'La forbice copre varianti tipiche di allestimento ed edificio; il Suo progetto specifico può discostarsene.',
    blitzAutoDisclaimer: 'Questa stima preliminare non è un’offerta vincolante. I prezzi vincolanti vengono definiti dopo sopralluogo, rilievo e campionatura dei materiali — verificati e controfirmati dalla nostra direzione lavori.',
    blitzAutoPdfNote: 'Nel PDF dettagliato allegato trova questo calcolo standard voce per voce, adattato alle dimensioni del progetto da Lei indicate.',
    blitzAutoStep1: 'Risponda a questa e-mail o fissi subito un appuntamento — la nostra direzione lavori esamina personalmente il Suo progetto.',
    blitzAutoStep2: 'Sopralluogo e rilievo in loco con Daniel o Monica.',
    blitzAutoStep3: 'Riceverà la Sua offerta vincolante a prezzo fisso — nero su bianco.',

    // blitz project rows / calculator summary (customer)
    rowRequest: 'Richiesta',
    rowRequestValue: 'Importato dal preventivatore',
    rowCalculator: 'Preventivatore',
    rowEstimate: 'Stima preliminare',
    rowStart: 'Inizio lavori',
    rowObjectType: 'Tipo di immobile',
    rowMid: 'Valore medio',
    rowGuideValue: 'Valore indicativo',
    calcFromCalculator: 'Importato dal preventivatore',
    calcChosenServices: 'Lavorazioni selezionate:',
    emptyPreselection: 'Nessuna preselezione',
    calcColPosition: 'Voce',
    calcColQuantity: 'Quantità',
    calcColTotal: 'Totale',
    calcNPositions: '{n} voci',

    // --- calculator-pdf covering email ---
    pdfMailSubject: 'Il Suo riepilogo PDF · {kind}',
    pdfMailTitle: 'Il Suo riepilogo PDF è pronto.',
    pdfMailEyebrow: 'Preventivatore · Riepilogo PDF',
    pdfMailIntro: 'In allegato trova il Suo riepilogo PDF dal preventivatore Prima Vista per {kind}. Tutti gli importi, le voci e le note sono riassunti lì in modo compatto.',
    pdfMailIntroText1: 'In allegato trova il Suo riepilogo PDF dal preventivatore Prima Vista per {kind}.',
    pdfMailIntroText2: 'Tutti gli importi, le voci e le note sono riassunti lì in modo compatto.',
    pdfMailStep1: 'Apra il PDF allegato per il riepilogo completo.',
    pdfMailStep2: 'Per un’offerta vincolante verifichiamo rilievo, stato esistente e scelta dei materiali.',
    pdfMailStep3: 'Risponda direttamente a questa e-mail se desidera che affiniamo la stima.',

    // --- PDF document (calculatorPdf.ts) ---
    pdfDocTitle: 'Preventivo Prima Vista - {kind}',
    pdfDocSubject: 'Stima preliminare dal preventivatore',
    pdfHeaderTagline: 'RISTRUTTURAZIONE & COSTRUZIONE · STIMA PRELIMINARE',
    pdfBandTagline: 'RISTRUTTURAZIONE & COSTRUZIONE · DOCUMENTI D’ORDINE',
    pdfTitleEstimate: 'Preventivo',
    pdfTitleProductDetails: 'Dettagli prodotti',

    pdfAddrFirma: 'Azienda',
    pdfAddrName: 'Nome e cognome',
    pdfAddrStreet: 'Via',
    pdfAddrZipCity: 'CAP e città',
    pdfAddrState: 'Regione',
    pdfAddrCountry: 'Paese',
    pdfAddrTaxId: 'Partita IVA / codice fiscale',

    pdfProjectDataTitle: 'Dati di progetto e di fatturazione',
    pdfProjectDataIntro: 'Da compilare al momento dell’ordine. La selezione del preventivatore resta consultabile in allegato.',
    pdfLinkLabel: 'Link alla selezione del preventivatore:',
    pdfBillingAddress: 'Indirizzo di fatturazione',
    pdfProjectAddress: 'Indirizzo di progetto / consegna',
    pdfAddressHint: 'Nota: se l’indirizzo di fatturazione e quello di progetto coincidono, è sufficiente una sola voce a sinistra. Indicare a destra eventuali indirizzi di consegna o di cantiere diversi.',

    pdfFooterOfficeTitle: 'Sede legale',
    pdfFooterContactTitle: 'Contatto',
    pdfFooterLegalTitle: 'Informazioni legali',
    pdfFooterSwitzerlandTitle: 'Svizzera',
    pdfFooterPage: 'Pagina {n} / {total}',
    contactPrimaryLabel: 'Contatto principale',
    contactSecondaryLabel: 'Contatto alternativo (Sonja)',
    pdfFooterEmail: 'E-mail: office@primavista-bauprojekte.com',
    pdfFooterTaxNr: 'Cod. fiscale: 01483039527',
    pdfFooterVatId: 'Partita IVA: DE 358812805',
    pdfFooterCourt: 'Tribunale di Francoforte sul Meno',

    pdfSummaryEyebrow: 'DAL PREVENTIVATORE',
    pdfSummaryTotal: 'TOTALE',
    pdfSummaryNet: 'Netto {value}',
    pdfSummaryVat: 'più 19% IVA {value}',
    pdfSummaryScope: '{label}: {value}',
    pdfSummaryEstimate: 'Stima preliminare: {min} - {max}',
    pdfSummaryGuide: 'Valore indicativo: {value} / m²',

    pdfTableProduct: 'Prodotto / lavorazione',
    pdfTableCount: 'Quantità',
    pdfTableUnitPrice: 'Prezzo unit. netto',
    pdfTableTotalNet: 'Totale netto',

    pdfPositionsTitle: 'Riepilogo delle voci selezionate',
    pdfNoPositions: 'Nessuna voce attiva selezionata.',

    pdfTotalNetSum: 'Totale netto',
    pdfTotalVat: 'più 19% IVA',
    pdfTotalGross: 'Totale',
    pdfDisclaimer: 'Questa stima preliminare si basa sulle voci selezionate nel preventivatore online. I prezzi vincolanti vengono definiti dopo il rilievo, la verifica della situazione edilizia e la campionatura dei materiali.',

    pdfProductDetailsIntro: 'Dettagli sulle voci selezionate nel preventivatore. Quantità, esecuzione e scelta dei materiali vengono verificate in loco e confermate nell’offerta finale.',
    pdfProductProdNr: 'N. prod.: {sku}',
    pdfProductType: 'Tipo: {type}',
    pdfProductQuantity: 'Quantità: {value}',
    pdfProductUnitPrice: 'Prezzo unit. netto: {value}',
    pdfProductTotalNet: 'Totale netto: {value}',
    pdfProductGenericDescription: '{label} fa parte del calcolo selezionato nell’ambito {category}. Quantità, esecuzione e scelta dei materiali vengono verificate in loco e confermate nell’offerta finale.',

    pdfSignTitle: 'Conferimento dell’incarico e conferme',
    pdfSignIntro: 'Questa pagina è destinata al successivo conferimento dell’incarico. Il riepilogo PDF è una stima preliminare. L’incarico diventa vincolante solo dopo il rilievo, l’offerta finale e la firma.',
    pdfSignCard1Title: 'Incarico dopo l’offerta finale',
    pdfSignCard1Body: 'Conferisco l’incarico a Prima Vista Bauprojekte sulla base dell’offerta finalizzata e della data di esecuzione concordata insieme.',
    pdfSignCard2Title: 'Condizioni contrattuali lette',
    pdfSignCard2Body: 'Confermo di aver ricevuto, letto e accettato le condizioni generali e le condizioni contrattuali.',
    pdfSignCard3Title: 'Entità delle prestazioni e base dei materiali',
    pdfSignCard3Body: 'Le prestazioni, le quantità e i materiali elencati costituiscono la base per la verifica, la pianificazione e l’offerta. Eventuali modifiche vengono indicate separatamente.',
    pdfSignCard4Title: 'Recesso e revoca',
    pdfSignCard4Body: 'Confermo di aver ricevuto e letto le informazioni sul diritto di recesso e di revoca, modulo incluso, ove applicabili.',
    pdfSignConfirmed: 'confermato',
    pdfSignFinalTitle: 'Conclusione del conferimento dell’incarico',
    pdfSignFinalBody: 'Con data e firma le conferme sopra indicate vengono confermate congiuntamente.',
    pdfSignDatePlace: 'Data, luogo',
    pdfSignSignature: 'Firma del committente',

    pdfScopeDefault: 'Entità',
  },

  fr: {
    // --- shared ---
    signature: 'Cordialement,\nDaniel & Monica Irimia · Prima Vista Bauprojekte',
    signatureLine1: 'Cordialement,',
    signatureName: 'Daniel & Monica Irimia',
    company: 'Prima Vista Bauprojekte',
    unitFallback: 'pce',
    scopeArea: 'Surface',
    scopeExtent: 'Ampleur',
    scopeAreaOrExtent: 'Surface / ampleur',
    nextSteps: 'Les prochaines étapes',

    // --- kontakt customer confirmation ---
    kontaktSubject: 'Merci pour votre demande — Prima Vista Bauprojekte',
    kontaktTitle: 'Merci, {name}.',
    kontaktEyebrow: 'Accusé de réception · Demande de contact',
    kontaktIntro: 'Nous avons bien reçu votre demande. Nous étudions votre projet et revenons vers vous sous 24 heures — par e-mail à {email}{phone}.',
    kontaktIntroText: 'Nous avons bien reçu votre demande. Nous revenons vers vous sous 24 heures — par e-mail à {email}{phone}.',
    kontaktPhoneSuffix: ' ou par téléphone au {tel}',
    kontaktRowEmail: 'Votre e-mail',
    kontaktRowTel: 'Téléphone',
    kontaktRowArt: 'Type',
    kontaktStep1: 'Nous étudions vos informations et préparons les premières questions.',
    kontaktStep2: 'Vous recevez une réponse écrite ou un rappel téléphonique.',
    kontaktStep3: 'Sur demande, nous convenons d’un rendez-vous sur place.',
    kontaktRowWunschtermin: 'Date souhaitée',
    kontaktRowZeitfenster: 'Heure exacte',
    kontaktRowTerminart: 'Type de rendez-vous',
    kontaktRowAlternativ: 'Date alternative',
    kontaktTerminNote: 'L’heure exacte souhaitée est réservée dans le calendrier — elle ne devient définitive qu’après notre confirmation sous 48 heures.',

    // --- blitz customer confirmation ---
    blitzSubject: 'Nous avons bien reçu votre demande express — Prima Vista Bauprojekte',
    blitzTitle: 'Merci, {name}.',
    blitzEyebrow: 'Accusé de réception · Offre express',
    blitzIntro: 'Nous avons bien reçu votre demande express. Nous analysons votre projet et vous transmettons une première estimation de coûts sous 24 heures — par e-mail à {email}{phone}.',
    blitzIntroText: 'Nous avons bien reçu votre demande express. Vous recevez une première estimation de coûts sous 24 heures par e-mail à {email}{phone}.',
    blitzYourDetails: 'Vos informations',
    blitzYourServices: 'Les prestations que vous avez sélectionnées',
    blitzYourNote: 'Votre remarque',
    blitzCalcHeading: 'Votre calcul repris',
    blitzStep1: 'La direction de chantier vérifie la surface ou l’ampleur, le site et les prestations souhaitées.',
    blitzStep2: 'Vous recevez une estimation de coûts préliminaire par écrit.',
    blitzStep3: 'Sur demande, nous affinons l’offre sur place — ferme après métré.',
    blitzStep3Text: 'Sur demande, nous affinons l’offre sur place.',

    // --- blitz automatic estimate (customer) ---
    blitzAutoSubject: 'Votre estimation de coûts préliminaire avec PDF détaillé — Prima Vista Bauprojekte',
    blitzAutoTitle: 'Votre estimation de coûts préliminaire, {name}.',
    blitzAutoEyebrow: 'Estimation préliminaire · Offre express',
    blitzAutoIntro: 'Merci pour votre demande. Nous avons appliqué le calcul standard de notre calculateur en ligne à la dimension de projet que vous avez indiquée afin d’établir votre estimation de coûts préliminaire.',
    blitzAutoRangeLabel: 'Investissement estimé',
    blitzAutoRangeNote: 'Tous les montants sont nets, TVA légale en sus.',
    blitzAutoAssumptions: 'Hypothèses et remarques',
    blitzAutoAssumption1: 'Calculée avec la configuration standard du calculateur en ligne, adaptée à la dimension de projet indiquée et pour un bâti existant typique.',
    blitzAutoAssumption2: 'Non compris : solutions particulières telles qu’interventions structurelles, dépollution ou exigences liées aux monuments historiques.',
    blitzAutoAssumption3: 'La fourchette couvre des variantes typiques d’aménagement et de bâtiment ; votre projet concret peut s’en écarter.',
    blitzAutoDisclaimer: 'Cette estimation préliminaire n’est pas une offre ferme. Les prix fermes sont établis après visite, métré et échantillonnage des matériaux — vérifiés et contresignés par notre direction de chantier.',
    blitzAutoPdfNote: 'Le PDF détaillé joint présente ce calcul standard poste par poste, adapté à la dimension de projet que vous avez indiquée.',
    blitzAutoStep1: 'Répondez à cet e-mail ou convenez directement d’un rendez-vous — notre direction de chantier examine personnellement votre projet.',
    blitzAutoStep2: 'Visite sur place et métré par Daniel ou Monica.',
    blitzAutoStep3: 'Vous recevez votre offre ferme à prix fixe — noir sur blanc.',

    // blitz project rows / calculator summary (customer)
    rowRequest: 'Demande',
    rowRequestValue: 'Repris du calculateur',
    rowCalculator: 'Calculateur',
    rowEstimate: 'Estimation préliminaire',
    rowStart: 'Début des travaux',
    rowObjectType: 'Type de bien',
    rowMid: 'Valeur moyenne',
    rowGuideValue: 'Valeur indicative',
    calcFromCalculator: 'Repris du calculateur',
    calcChosenServices: 'Prestations sélectionnées :',
    emptyPreselection: 'Aucune présélection pour l’instant',
    calcColPosition: 'Poste',
    calcColQuantity: 'Quantité',
    calcColTotal: 'Total',
    calcNPositions: '{n} postes',

    // --- calculator-pdf covering email ---
    pdfMailSubject: 'Votre récapitulatif PDF · {kind}',
    pdfMailTitle: 'Votre récapitulatif PDF est disponible.',
    pdfMailEyebrow: 'Calculateur · Récapitulatif PDF',
    pdfMailIntro: 'Vous trouverez en pièce jointe votre récapitulatif PDF issu du calculateur Prima Vista pour {kind}. Tous les montants, postes et remarques y sont résumés de manière compacte.',
    pdfMailIntroText1: 'Vous trouverez en pièce jointe votre récapitulatif PDF issu du calculateur Prima Vista pour {kind}.',
    pdfMailIntroText2: 'Tous les montants, postes et remarques y sont résumés de manière compacte.',
    pdfMailStep1: 'Ouvrez le PDF joint pour consulter le récapitulatif complet.',
    pdfMailStep2: 'Pour une offre ferme, nous vérifions le métré, l’existant et le choix des matériaux.',
    pdfMailStep3: 'Répondez directement à cet e-mail si vous souhaitez que nous affinions l’estimation.',

    // --- PDF document (calculatorPdf.ts) ---
    pdfDocTitle: 'Devis Prima Vista - {kind}',
    pdfDocSubject: 'Estimation préliminaire issue du calculateur',
    pdfHeaderTagline: 'RÉNOVATION & CONSTRUCTION · ESTIMATION PRÉLIMINAIRE',
    pdfBandTagline: 'RÉNOVATION & CONSTRUCTION · DOCUMENTS DE COMMANDE',
    pdfTitleEstimate: 'Devis',
    pdfTitleProductDetails: 'Détails des produits',

    pdfAddrFirma: 'Société',
    pdfAddrName: 'Nom et prénom',
    pdfAddrStreet: 'Rue',
    pdfAddrZipCity: 'Code postal et ville',
    pdfAddrState: 'Région',
    pdfAddrCountry: 'Pays',
    pdfAddrTaxId: 'N° de TVA / numéro fiscal',

    pdfProjectDataTitle: 'Données de projet et de facturation',
    pdfProjectDataIntro: 'À compléter lors de la passation de commande. La sélection du calculateur reste consultable en pièce jointe.',
    pdfLinkLabel: 'Lien vers la sélection du calculateur :',
    pdfBillingAddress: 'Adresse de facturation',
    pdfProjectAddress: 'Adresse de projet / de livraison',
    pdfAddressHint: 'Remarque : si l’adresse de facturation et l’adresse de projet sont identiques, une seule saisie à gauche suffit. Veuillez indiquer à droite toute adresse de livraison ou de chantier différente.',

    pdfFooterOfficeTitle: 'Siège social',
    pdfFooterContactTitle: 'Contact',
    pdfFooterLegalTitle: 'Mentions légales',
    pdfFooterSwitzerlandTitle: 'Suisse',
    pdfFooterPage: 'Page {n} / {total}',
    contactPrimaryLabel: 'Contact principal',
    contactSecondaryLabel: 'Autre contact (Sonja)',
    pdfFooterEmail: 'E-mail : office@primavista-bauprojekte.com',
    pdfFooterTaxNr: 'N° fiscal : 01483039527',
    pdfFooterVatId: 'N° de TVA : DE 358812805',
    pdfFooterCourt: 'Tribunal d’instance de Frankfurt am Main',

    pdfSummaryEyebrow: 'ISSU DU CALCULATEUR',
    pdfSummaryTotal: 'MONTANT TOTAL',
    pdfSummaryNet: 'Net {value}',
    pdfSummaryVat: 'hors TVA (TVA 19 % en sus) {value}',
    pdfSummaryScope: '{label} : {value}',
    pdfSummaryEstimate: 'Estimation préliminaire : {min} - {max}',
    pdfSummaryGuide: 'Valeur indicative : {value} / m²',

    pdfTableProduct: 'Produit / prestation',
    pdfTableCount: 'Quantité',
    pdfTableUnitPrice: 'Prix unitaire net',
    pdfTableTotalNet: 'Total net',

    pdfPositionsTitle: 'Récapitulatif des postes sélectionnés',
    pdfNoPositions: 'Aucun poste actif sélectionné.',

    pdfTotalNetSum: 'Total net',
    pdfTotalVat: 'hors TVA (TVA 19 % en sus)',
    pdfTotalGross: 'Montant total',
    pdfDisclaimer: 'Cette estimation préliminaire repose sur les postes sélectionnés dans le calculateur en ligne. Les prix fermes sont établis après métré, vérification de la situation du bâti et échantillonnage des matériaux.',

    pdfProductDetailsIntro: 'Détails des postes sélectionnés dans le calculateur. Les quantités, l’exécution et le choix des matériaux sont vérifiés sur place et confirmés dans l’offre finale.',
    pdfProductProdNr: 'N° prod. : {sku}',
    pdfProductType: 'Type : {type}',
    pdfProductQuantity: 'Quantité : {value}',
    pdfProductUnitPrice: 'Prix unitaire net : {value}',
    pdfProductTotalNet: 'Total net : {value}',
    pdfProductGenericDescription: '{label} fait partie du calcul sélectionné dans le domaine {category}. Les quantités, l’exécution et le choix des matériaux sont vérifiés sur place et confirmés dans l’offre finale.',

    pdfSignTitle: 'Passation de commande et confirmations',
    pdfSignIntro: 'Cette page est destinée à la passation de commande ultérieure. Le récapitulatif PDF est une estimation préliminaire. La commande ne devient ferme qu’après le métré, l’offre finale et la signature.',
    pdfSignCard1Title: 'Commande après l’offre finale',
    pdfSignCard1Body: 'Je confie la mission à Prima Vista Bauprojekte sur la base de l’offre finalisée et de la date d’exécution convenue ensemble.',
    pdfSignCard2Title: 'Conditions contractuelles lues',
    pdfSignCard2Body: 'Je confirme avoir reçu, lu et accepté les conditions générales et les conditions contractuelles.',
    pdfSignCard3Title: 'Étendue des prestations et base des matériaux',
    pdfSignCard3Body: 'Les prestations, quantités et matériaux indiqués constituent la base de la vérification, de la planification et de l’offre. Toute modification est indiquée séparément.',
    pdfSignCard4Title: 'Rétractation et résiliation',
    pdfSignCard4Body: 'Je confirme avoir reçu et lu les informations sur le droit de rétractation et de résiliation, formulaire inclus, dans la mesure où elles s’appliquent.',
    pdfSignConfirmed: 'confirmé',
    pdfSignFinalTitle: 'Conclusion de la passation de commande',
    pdfSignFinalBody: 'Avec la date et la signature, les confirmations indiquées ci-dessus sont confirmées conjointement.',
    pdfSignDatePlace: 'Date, lieu',
    pdfSignSignature: 'Signature du donneur d’ordre',

    pdfScopeDefault: 'Ampleur',
  },
} as const;

// Every locale carries the exact same key set, so the German key union is the
// canonical type for `tt` lookups.
export type StringKey = keyof (typeof STRINGS)['de'];

/** Translate a flat catalogue key for the locale (falls back to German). */
export function tt(locale: Locale, key: StringKey): string {
  return STRINGS[locale][key] ?? STRINGS[DEFAULT_LOCALE][key];
}

import type { Locale } from '../i18n/routes';
import deBlog from '../i18n/locales/de/blog.json';
import enBlog from '../i18n/locales/en/blog.json';
import itBlog from '../i18n/locales/it/blog.json';
import frBlog from '../i18n/locales/fr/blog.json';
import dePages from '../i18n/locales/de/pages.json';
import enPages from '../i18n/locales/en/pages.json';
import itPages from '../i18n/locales/it/pages.json';
import frPages from '../i18n/locales/fr/pages.json';

export type RouteMeta = {
  title: string;
  description: string;
};

export const SITE_NAME = 'Prima Vista Bauprojekte';
export const SITE_ORIGIN = 'https://www.primavista-bauprojekte.com';

export const DEFAULT_ROUTE_META: RouteMeta = {
  title: 'Premium Sanierung & Bau in Deutschland und der Schweiz',
  description:
    'Prima Vista Bauprojekte plant und realisiert Sanierung, Renovierung und Ausbau aus einer Hand in Deutschland und der Schweiz.',
};

type MetaSource = { metaTitle: string; lede: string };
type PageCatalog = {
  calc: Record<keyof typeof dePages.calc, MetaSource>;
  trade: Record<keyof typeof dePages.trade, MetaSource>;
  material: { metaTitle: string; metaDescription: string };
};
type BlogCatalog = { pageTitle: string; masthead: { sub: string } };
type CalcMetaKey = keyof PageCatalog['calc'];
type TradeMetaKey = keyof PageCatalog['trade'];

const TRADE_ROUTE_KEYS = {
  '/badsanierung': 'badsanierung',
  '/badsanierung-gaeste-wc': 'badsanierung',
  '/kuechen-moebelbau': 'kueche',
  '/boeden-belaege': 'boeden',
  '/elektroinstallation': 'elektro',
  '/trockenbau': 'trockenbau',
  '/maler-lackierer': 'maler',
  '/fassadensanierung': 'fassade',
  '/abdichtung-keller': 'abdichtung',
  '/dachsanierung': 'dach',
  '/treppen-gelaender': 'treppen',
  '/garten-aussenanlagen': 'garten',
  '/barrierefreiheit': 'barrierefreiheit',
  '/fenstertechnik': 'fenster',
  '/rohbau-abbruch': 'rohbau',
  '/tueren-zargen': 'tueren',
  '/sanitaerinstallation': 'wasser',
  '/zaeune': 'zaeune',
} as const satisfies Record<string, TradeMetaKey>;

const CALC_ROUTE_KEYS = {
  '/haus-sanierung': 'haus',
  '/wohnung-sanierung': 'wohnung',
  '/gastronomie-ausbau': 'gastro',
  '/buero-ausbau': 'buero',
  '/heizkoerper': 'heizkoerper',
  '/heizstraenge': 'heizstraenge',
  '/fussbodenheizung': 'fussboden',
  '/waermepumpe': 'waermepumpe',
  '/gas-heizung': 'gas',
  '/pelletofen': 'pellet',
  '/saunaofen': 'sauna',
} as const satisfies Record<string, CalcMetaKey>;

const MISSING_DE_ROUTE_META_KEYS = [
  '/materialien',
  '/badsanierung-gaeste-wc',
  '/heizkoerper',
  '/heizstraenge',
  '/fussbodenheizung',
  '/waermepumpe',
  '/gas-heizung',
  '/pelletofen',
  '/saunaofen',
] as const;

function metaFromEntry(entry: MetaSource): RouteMeta {
  return { title: entry.metaTitle, description: entry.lede };
}

function metaFromBlog(blog: BlogCatalog): RouteMeta {
  return { title: blog.pageTitle, description: blog.masthead.sub };
}

function localizedServiceMeta(pages: PageCatalog, blog: BlogCatalog): Record<string, RouteMeta> {
  const meta: Record<string, RouteMeta> = {
    '/blog': metaFromBlog(blog),
    '/materialien': { title: pages.material.metaTitle, description: pages.material.metaDescription },
  };

  for (const [path, key] of Object.entries(TRADE_ROUTE_KEYS) as Array<[string, TradeMetaKey]>) {
    meta[path] = metaFromEntry(pages.trade[key]);
  }

  for (const [path, key] of Object.entries(CALC_ROUTE_KEYS) as Array<[string, CalcMetaKey]>) {
    meta[path] = metaFromEntry(pages.calc[key]);
  }

  return meta;
}

function pickRouteMeta<Key extends string>(
  source: Record<string, RouteMeta>,
  keys: readonly Key[],
): Record<Key, RouteMeta> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<Key, RouteMeta>;
}

const SERVICE_ROUTE_META: Record<Locale, Record<string, RouteMeta>> = {
  de: localizedServiceMeta(dePages, deBlog),
  en: localizedServiceMeta(enPages, enBlog),
  it: localizedServiceMeta(itPages, itBlog),
  fr: localizedServiceMeta(frPages, frBlog),
};

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': DEFAULT_ROUTE_META,
  '/gewerke': {
    title: 'Gewerke - alle Leistungen im Überblick',
    description: 'Alle Gewerke für Sanierung, Ausbau und Renovierung: Bad, Küche, Böden, Elektro, Rohbau, Fassade, Dach und mehr.',
  },
  '/badsanierung': {
    title: 'Badsanierung & Gäste-WC',
    description: 'Badsanierung und Gäste-WC aus einer Hand, inklusive Planung, Ausbau, Installation, Fliesen und Ausstattung.',
  },
  '/kuechen-moebelbau': {
    title: 'Küchen & Möbelbau Kostenrechner',
    description: 'Küchenplanung, Einbauküchen, Arbeitsplatten, Möbelbau und Ausbau mit transparentem Kostenrahmen kalkulieren.',
  },
  '/boeden-belaege': {
    title: 'Böden & Beläge Kostenrechner',
    description: 'Parkett, Vinyl, Fliesen, Teppich, Sockelleisten und Bodenaufbereitung für Wohn- und Gewerbeflächen kalkulieren.',
  },
  '/elektroinstallation': {
    title: 'Elektroinstallation Kostenrechner',
    description: 'Elektroinstallation, Sicherungskasten, Netzwerk, Lichttechnik und Smart-Home-Leistungen kalkulieren.',
  },
  '/trockenbau': {
    title: 'Trockenbau Kostenrechner',
    description: 'Trockenbauwände, Decken, Vorsatzwände, Dachschrägen und Spachtelarbeiten mit Richtpreisen kalkulieren.',
  },
  '/maler-lackierer': {
    title: 'Maler & Lackierer Kostenrechner',
    description: 'Malerarbeiten, Spachtelung, Tapeten, Fassadenanstrich und Lackierungen für Sanierungsprojekte kalkulieren.',
  },
  '/fassadensanierung': {
    title: 'Fassadensanierung Kostenrechner',
    description: 'Fassadendämmung, Anstrich, Holzverkleidung, Klinker, Naturstein und Vorhangfassaden kalkulieren.',
  },
  '/abdichtung-keller': {
    title: 'Abdichtung & Keller',
    description: 'Kellerabdichtung, Perimeterabdichtung, Horizontalsperre und Feuchteschutz für Bestandsgebäude kalkulieren.',
  },
  '/dachsanierung': {
    title: 'Dachsanierung Kostenrechner',
    description: 'Dacheindeckung, Dämmung, Dachstuhl, Gauben, Dachfenster und Innenausbau transparent kalkulieren.',
  },
  '/treppen-gelaender': {
    title: 'Treppen & Geländer Kostenrechner',
    description: 'Treppen, Geländer, Durchbrüche, Außentreppen und Treppenaufbereitung für Sanierung und Neubau kalkulieren.',
  },
  '/garten-aussenanlagen': {
    title: 'Garten & Außenanlagen Kostenrechner',
    description: 'Terrassen, Carports, Gartenhäuser, Mauern, Beleuchtung, Zaunanlagen und Außenanlagen kalkulieren.',
  },
  '/barrierefreiheit': {
    title: 'Barrierefreies Bad Kostenrechner',
    description: 'Barrierefreie Bäder, bodengleiche Duschen, seniorengerechte Ausstattung und rollstuhlgerechte Lösungen kalkulieren.',
  },
  '/fenstertechnik': {
    title: 'Fenstertechnik Kostenrechner',
    description: 'Fenster, Balkontüren, Dachfenster, Rollläden, Markisen und Garagentore mit Montage kalkulieren.',
  },
  '/rohbau-abbruch': {
    title: 'Rohbau & Abbruch Kostenrechner',
    description: 'Abbruch, Rohbau, Estrich, Stahlträger, Verputz, Mauerwerk und Entsorgung transparent kalkulieren.',
  },
  '/tueren-zargen': {
    title: 'Türen & Zargen Kostenrechner',
    description: 'Innentüren, Zargen, Beschläge, Haustüren, Brandschutztüren und Montageleistungen kalkulieren.',
  },
  '/sanitaerinstallation': {
    title: 'Wasserinstallation Kostenrechner',
    description: 'Sanitärinstallation, Trinkwasser, Abwasser, Hauptstränge und Anschlussarbeiten für Sanierung kalkulieren.',
  },
  '/zaeune': {
    title: 'Zäune Kostenrechner',
    description: 'Zaunanlagen, Tore, Sichtschutz und Montage für Außenbereiche kalkulieren.',
  },
  '/komplett-pakete': {
    title: 'Komplettpakete für Sanierung & Bau',
    description: 'Komplettpakete für Haus, Wohnung, Gastronomie und Büro mit koordinierten Gewerken und transparentem Kostenrahmen.',
  },
  '/projekte': {
    title: 'Projekte & Referenzen',
    description: 'Referenzen und Projektbeispiele von Prima Vista Bauprojekte für Wohnprojekte, Gastronomie, Hotels und Gewerbe.',
  },
  '/blog': {
    title: 'Magazin',
    description: 'Ratgeber, Einblicke und Projektwissen rund um Sanierung, Ausbau, Renovierung und Bauleitung.',
  },
  '/kontakt': {
    title: 'Kontakt - Anfrage stellen',
    description: 'Kontakt zu Prima Vista Bauprojekte für Sanierung, Renovierung, Ausbau und Bauprojekte in Deutschland und der Schweiz.',
  },
  '/blitz-angebot': {
    title: 'Blitzangebot in 24 Stunden',
    description: 'Schnelle Projektanfrage für Sanierung und Ausbau mit Rückmeldung innerhalb von 24 Stunden an Werktagen.',
  },
  '/kalkulator': {
    title: 'Kostenkalkulator für Sanierung & Bau',
    description: 'Interaktiver Kostenkalkulator für Haus, Wohnung, Gewerke und Heizmethoden mit transparenten Richtpreisen.',
  },
  '/haus-sanierung': {
    title: 'Haussanierung kalkulieren',
    description: 'Haussanierung mit Gewerken, Materialien und Richtpreisen Schritt für Schritt kalkulieren.',
  },
  '/wohnung-sanierung': {
    title: 'Wohnungssanierung kalkulieren',
    description: 'Wohnungssanierung für Studio, Zwei-Zimmer, Drei-Zimmer und Maisonette mit Kostenrahmen kalkulieren.',
  },
  '/gastronomie-ausbau': {
    title: 'Gastronomieausbau kalkulieren',
    description: 'Ausbau für Restaurants, Bars, Cafés und Gastronomieflächen mit Gewerken und Richtpreisen kalkulieren.',
  },
  '/buero-ausbau': {
    title: 'Büroausbau kalkulieren',
    description: 'Büroflächen, Praxen und Arbeitswelten mit Ausbaugrad, Fläche, Gewerken und Richtpreisen kalkulieren.',
  },
  '/heizmethoden': {
    title: 'Moderne Heizmethoden - Wärmepumpe, Gas, Pellet & mehr',
    description: 'Heizmethoden wie Wärmepumpe, Gasheizung, Pellet, Fußbodenheizung, Heizkörper und Warmwasser vergleichen.',
  },
  '/impressum': {
    title: 'Impressum',
    description: 'Impressum und Anbieterkennzeichnung der Prima Vista Bauprojekte Webseite.',
  },
  '/datenschutz': {
    title: 'Datenschutzerklärung',
    description: 'Datenschutzerklärung mit Informationen zur Verarbeitung personenbezogener Daten auf dieser Webseite.',
  },
  ...pickRouteMeta(SERVICE_ROUTE_META.de, MISSING_DE_ROUTE_META_KEYS),
};

// Localized route-meta overrides. Routes not yet listed here fall back to the
// German meta above, so SEO never regresses while translation rolls out.
const ROUTE_META_I18N: Record<Exclude<Locale, 'de'>, Record<string, RouteMeta>> = {
  en: {
    '/': {
      title: 'Premium renovation & construction in Germany and Switzerland',
      description:
        'Prima Vista Bauprojekte plans and delivers renovation, refurbishment and fit-out from a single source in Germany and Switzerland.',
    },
    '/impressum': {
      title: 'Legal notice',
      description: 'Legal notice and provider identification for the Prima Vista Bauprojekte website.',
    },
    '/datenschutz': {
      title: 'Privacy policy',
      description: 'Privacy policy with information on the processing of personal data on this website.',
    },
    '/kontakt': {
      title: 'Contact – make an enquiry',
      description: 'Contact Prima Vista Bauprojekte for renovation, refurbishment, fit-out and building projects in Germany and Switzerland.',
    },
    '/heizmethoden': {
      title: 'Modern heating methods – heat pump, gas, pellet & more',
      description: 'Compare heating methods such as heat pump, gas heating, pellet, underfloor heating, radiators and hot water.',
    },
    '/gewerke': {
      title: 'Trades – all services at a glance',
      description: 'All trades for renovation, fit-out and refurbishment: bathroom, kitchen, floors, electrical, shell, façade, roof and more.',
    },
    '/komplett-pakete': {
      title: 'Complete packages for renovation & construction',
      description: 'Complete packages for house, apartment, hospitality and office with coordinated trades and a transparent cost framework.',
    },
    '/projekte': {
      title: 'Projects & references',
      description: 'References and project examples from Prima Vista Bauprojekte for homes, hospitality, hotels and commercial spaces.',
    },
    '/kalkulator': {
      title: 'Cost calculator for renovation & construction',
      description: 'Interactive cost calculator for house, apartment, trades and heating methods with transparent guide prices.',
    },
    '/blitz-angebot': {
      title: 'Express quote within 24 hours',
      description: 'A fast project enquiry for renovation and fit-out with a reply within 24 hours on working days.',
    },
    ...SERVICE_ROUTE_META.en,
  },
  it: {
    '/': {
      title: 'Ristrutturazione e costruzione premium in Germania e Svizzera',
      description:
        'Prima Vista Bauprojekte progetta e realizza ristrutturazione, rinnovo e allestimento da un unico interlocutore in Germania e Svizzera.',
    },
    '/impressum': {
      title: 'Note legali',
      description: 'Note legali e identificazione del fornitore per il sito web di Prima Vista Bauprojekte.',
    },
    '/datenschutz': {
      title: 'Informativa sulla privacy',
      description: "Informativa sulla privacy con informazioni sul trattamento dei dati personali su questo sito web.",
    },
    '/kontakt': {
      title: 'Contatti – invia una richiesta',
      description: 'Contatti Prima Vista Bauprojekte per ristrutturazione, rinnovo, allestimento e progetti edilizi in Germania e Svizzera.',
    },
    '/heizmethoden': {
      title: 'Metodi di riscaldamento moderni – pompa di calore, gas, pellet e altro',
      description: 'Confronta metodi di riscaldamento come pompa di calore, riscaldamento a gas, pellet, riscaldamento a pavimento, radiatori e acqua calda.',
    },
    '/gewerke': {
      title: 'Lavori – tutti i servizi in sintesi',
      description: 'Tutte le lavorazioni per ristrutturazione, allestimento e rinnovo: bagno, cucina, pavimenti, impianti elettrici, struttura, facciata, tetto e altro.',
    },
    '/komplett-pakete': {
      title: 'Pacchetti completi per ristrutturazione e costruzione',
      description: 'Pacchetti completi per casa, appartamento, ristorazione e ufficio con lavorazioni coordinate e un quadro dei costi trasparente.',
    },
    '/projekte': {
      title: 'Progetti e referenze',
      description: 'Referenze ed esempi di progetti di Prima Vista Bauprojekte per abitazioni, ristorazione, hotel e spazi commerciali.',
    },
    '/kalkulator': {
      title: 'Preventivatore per ristrutturazione e costruzione',
      description: 'Preventivatore interattivo per casa, appartamento, lavorazioni e metodi di riscaldamento con prezzi indicativi trasparenti.',
    },
    '/blitz-angebot': {
      title: 'Preventivo express entro 24 ore',
      description: 'Una richiesta di progetto rapida per ristrutturazione e allestimento con risposta entro 24 ore nei giorni feriali.',
    },
    ...SERVICE_ROUTE_META.it,
  },
  fr: {
    '/': {
      title: 'Rénovation & construction premium en Allemagne et en Suisse',
      description:
        'Prima Vista Bauprojekte conçoit et réalise rénovation, réfection et aménagement clé en main en Allemagne et en Suisse.',
    },
    '/impressum': {
      title: 'Mentions légales',
      description: "Mentions légales et identification de l'éditeur du site Prima Vista Bauprojekte.",
    },
    '/datenschutz': {
      title: 'Politique de confidentialité',
      description: 'Politique de confidentialité avec informations sur le traitement des données personnelles sur ce site.',
    },
    '/kontakt': {
      title: 'Contact – faire une demande',
      description: 'Contactez Prima Vista Bauprojekte pour vos projets de rénovation, réfection, aménagement et construction en Allemagne et en Suisse.',
    },
    '/heizmethoden': {
      title: 'Méthodes de chauffage modernes – pompe à chaleur, gaz, pellets et plus',
      description: 'Comparez les méthodes de chauffage : pompe à chaleur, chauffage au gaz, pellets, chauffage au sol, radiateurs et eau chaude.',
    },
    '/gewerke': {
      title: "Travaux – tous les services en un coup d'œil",
      description: 'Tous les corps de métier pour rénovation, aménagement et réfection : salle de bain, cuisine, sols, électricité, gros œuvre, façade, toiture et plus.',
    },
    '/komplett-pakete': {
      title: 'Forfaits complets pour rénovation & construction',
      description: 'Forfaits complets pour maison, appartement, restauration et bureau avec corps de métier coordonnés et un cadre de coûts transparent.',
    },
    '/projekte': {
      title: 'Projets & références',
      description: 'Références et exemples de projets de Prima Vista Bauprojekte pour habitations, restauration, hôtels et espaces commerciaux.',
    },
    '/kalkulator': {
      title: 'Calculateur de coûts pour rénovation & construction',
      description: 'Calculateur de coûts interactif pour maison, appartement, corps de métier et méthodes de chauffage avec prix indicatifs transparents.',
    },
    '/blitz-angebot': {
      title: 'Devis express sous 24 heures',
      description: 'Une demande de projet rapide pour rénovation et aménagement avec une réponse sous 24 heures les jours ouvrés.',
    },
    ...SERVICE_ROUTE_META.fr,
  },
};

const DYNAMIC_TITLES: Record<Locale, { blog: string; project: string }> = {
  de: { blog: 'Magazinbeitrag', project: 'Projekt' },
  en: { blog: 'Magazine article', project: 'Project' },
  it: { blog: 'Articolo del magazine', project: 'Progetto' },
  fr: { blog: 'Article du magazine', project: 'Projet' },
};

/**
 * Resolve route metadata for a canonical (German) path in the given locale.
 * Falls back to the German meta when a localized override is not yet defined.
 */
export function getRouteMeta(pathname: string, locale: Locale = 'de'): RouteMeta {
  const localeMeta = locale === 'de' ? ROUTE_META : ROUTE_META_I18N[locale];

  if (localeMeta[pathname]) return localeMeta[pathname];
  if (locale !== 'de' && ROUTE_META[pathname]) return ROUTE_META[pathname];

  if (pathname.startsWith('/blog/')) {
    return {
      title: DYNAMIC_TITLES[locale].blog,
      description: (localeMeta['/blog'] ?? ROUTE_META['/blog']).description,
    };
  }
  if (pathname.startsWith('/projekte/')) {
    return {
      title: DYNAMIC_TITLES[locale].project,
      description: (localeMeta['/projekte'] ?? ROUTE_META['/projekte']).description,
    };
  }
  return localeMeta['/'] ?? DEFAULT_ROUTE_META;
}

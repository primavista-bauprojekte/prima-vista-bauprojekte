import { lazy, Suspense, type ReactElement } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { LOCALES, ROUTE_KEYS, routePattern, toCanonicalPath } from './i18n/routes';
import './styles/components/route-loading.css';

// Lazy load all pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Gewerke = lazy(() => import('./pages/Gewerke'));
const Badsanierung = lazy(() => import('./pages/Badsanierung'));
const KuechenMoebelbau = lazy(() => import('./pages/KuechenMoebelbau'));
const BoedenBelaege = lazy(() => import('./pages/BoedenBelaege'));
const Elektroinstallation = lazy(() => import('./pages/Elektroinstallation'));
const Trockenbau = lazy(() => import('./pages/Trockenbau'));
const MalerLackierer = lazy(() => import('./pages/MalerLackierer'));
const Fassadensanierung = lazy(() => import('./pages/Fassadensanierung'));
const AbdichtungKeller = lazy(() => import('./pages/AbdichtungKeller'));
const Dachsanierung = lazy(() => import('./pages/Dachsanierung'));
const TreppenGelaender = lazy(() => import('./pages/TreppenGelaender'));
const GartenAussenanlagen = lazy(() => import('./pages/GartenAussenanlagen'));
const Barrierefreiheit = lazy(() => import('./pages/Barrierefreiheit'));
const Fenstertechnik = lazy(() => import('./pages/Fenstertechnik'));
const RohbauAbbruch = lazy(() => import('./pages/RohbauAbbruch'));
const TuerenZargen = lazy(() => import('./pages/TuerenZargen'));
const Sanitaerinstallation = lazy(() => import('./pages/Sanitaerinstallation'));
const Zaeune = lazy(() => import('./pages/Zaeune'));
const KomplettPakete = lazy(() => import('./pages/KomplettPakete'));
const Projekte = lazy(() => import('./pages/Projekte'));
const ProjektDetail = lazy(() => import('./pages/ProjektDetail'));
const Materialien = lazy(() => import('./pages/Materialien'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogDetail = lazy(() => import('./pages/BlogDetail'));
const Kontakt = lazy(() => import('./pages/Kontakt'));
const BlitzAngebot = lazy(() => import('./pages/BlitzAngebot'));
const Kalkulator = lazy(() => import('./pages/Kalkulator'));
const HausSanierung = lazy(() => import('./pages/HausSanierung'));
const WohnungSanierung = lazy(() => import('./pages/WohnungSanierung'));
const GastronomieAusbau = lazy(() => import('./pages/GastronomieAusbau'));
const BueroAusbau = lazy(() => import('./pages/BueroAusbau'));
const Heizmethoden = lazy(() => import('./pages/Heizmethoden'));
const Heizkoerper = lazy(() => import('./pages/Heizkoerper'));
const Heizstraenge = lazy(() => import('./pages/Heizstraenge'));
const Fussbodenheizung = lazy(() => import('./pages/Fussbodenheizung'));
const Waermepumpe = lazy(() => import('./pages/Waermepumpe'));
const GasHeizung = lazy(() => import('./pages/GasHeizung'));
const Pelletofen = lazy(() => import('./pages/Pelletofen'));
const Saunaofen = lazy(() => import('./pages/Saunaofen'));
const Impressum = lazy(() => import('./pages/Impressum'));
const Datenschutz = lazy(() => import('./pages/Datenschutz'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminBlog = lazy(() => import('./pages/AdminBlog'));
const AdminEditor = lazy(() => import('./pages/AdminEditor'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  const { pathname: rawPathname } = useLocation();
  const pathname = toCanonicalPath(rawPathname);

  if (pathname === '/blog') {
    return (
      <main className="route-loading route-loading--blog" aria-busy="true">
        <p className="route-loading__sr" role="status">Beiträge werden geladen.</p>
        <div className="route-loading__blog-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="route-loading__card" key={index}>
              <span className="route-loading__media route-loading__shimmer" />
              <span className="route-loading__card-body">
                <span className="route-loading__line route-loading__line--meta route-loading__shimmer" />
                <span className="route-loading__line route-loading__line--title route-loading__shimmer" />
                <span className="route-loading__line route-loading__line--title-short route-loading__shimmer" />
                <span className="route-loading__line route-loading__shimmer" />
                <span className="route-loading__line route-loading__shimmer" />
                <span className="route-loading__line route-loading__line--short route-loading__shimmer" />
              </span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (pathname.startsWith('/blog/')) {
    return (
      <main className="route-loading route-loading--article" aria-busy="true">
        <p className="route-loading__sr" role="status">Beitrag wird geladen.</p>
        <section className="route-loading__article-hero" aria-hidden="true">
          <div className="route-loading__article-inner">
            <span className="route-loading__line route-loading__line--back route-loading__shimmer" />
            <span className="route-loading__line route-loading__line--hero route-loading__shimmer" />
            <span className="route-loading__line route-loading__line--hero-short route-loading__shimmer" />
            <span className="route-loading__line route-loading__line--lede route-loading__shimmer" />
          </div>
        </section>
        <section className="route-loading__article-body" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span
              className={`route-loading__line route-loading__shimmer${index % 4 === 3 ? ' route-loading__line--short' : ''}`}
              key={index}
            />
          ))}
        </section>
      </main>
    );
  }

  if (pathname.startsWith('/admin')) {
    return (
      <main className="route-loading route-loading--admin" aria-busy="true">
        <p className="route-loading__state" role="status">Anmeldung wird geprüft …</p>
      </main>
    );
  }

  return (
    <main className="route-loading route-loading--page" aria-busy="true">
      <p className="route-loading__sr" role="status">Seite wird geladen.</p>
      <span className="route-loading__line route-loading__line--page route-loading__shimmer" aria-hidden="true" />
    </main>
  );
}

// Canonical (German) route key -> page element. Keys match those in the route
// registry; localized paths (/en/…, /it/…) are generated from this single map.
const PAGES: Record<string, ReactElement> = {
  '': <Home />,
  'gewerke': <Gewerke />,
  'badsanierung': <Badsanierung />,
  'badsanierung-gaeste-wc': <Badsanierung />,
  'kuechen-moebelbau': <KuechenMoebelbau />,
  'boeden-belaege': <BoedenBelaege />,
  'elektroinstallation': <Elektroinstallation />,
  'trockenbau': <Trockenbau />,
  'maler-lackierer': <MalerLackierer />,
  'fassadensanierung': <Fassadensanierung />,
  'abdichtung-keller': <AbdichtungKeller />,
  'dachsanierung': <Dachsanierung />,
  'treppen-gelaender': <TreppenGelaender />,
  'garten-aussenanlagen': <GartenAussenanlagen />,
  'barrierefreiheit': <Barrierefreiheit />,
  'fenstertechnik': <Fenstertechnik />,
  'rohbau-abbruch': <RohbauAbbruch />,
  'tueren-zargen': <TuerenZargen />,
  'sanitaerinstallation': <Sanitaerinstallation />,
  'zaeune': <Zaeune />,
  'komplett-pakete': <KomplettPakete />,
  'projekte': <Projekte />,
  'projekte/:slug': <ProjektDetail />,
  'materialien': <Materialien />,
  'blog': <Blog />,
  'blog/:slug': <BlogDetail />,
  'kontakt': <Kontakt />,
  'blitz-angebot': <BlitzAngebot />,
  'kalkulator': <Kalkulator />,
  'haus-sanierung': <HausSanierung />,
  'wohnung-sanierung': <WohnungSanierung />,
  'gastronomie-ausbau': <GastronomieAusbau />,
  'buero-ausbau': <BueroAusbau />,
  'heizmethoden': <Heizmethoden />,
  'heizkoerper': <Heizkoerper />,
  'heizstraenge': <Heizstraenge />,
  'fussbodenheizung': <Fussbodenheizung />,
  'waermepumpe': <Waermepumpe />,
  'gas-heizung': <GasHeizung />,
  'pelletofen': <Pelletofen />,
  'saunaofen': <Saunaofen />,
  'impressum': <Impressum />,
  'datenschutz': <Datenschutz />,
};

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            {ROUTE_KEYS.flatMap((key) =>
              LOCALES.map((locale) => (
                <Route
                  key={`${locale}:${key}`}
                  path={routePattern(key, locale)}
                  element={PAGES[key]}
                />
              )),
            )}
            {/* Admin stays un-prefixed and untranslated. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/blog" element={<AdminBlog />} />
            <Route path="/admin/blog/new" element={<AdminEditor />} />
            <Route path="/admin/blog/:slug" element={<AdminEditor />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

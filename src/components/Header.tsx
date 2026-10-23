import { businessContact } from '../../shared/contact';
import ContactNumbers from './ContactNumbers';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { NavLink, Link } from '../i18n/Link';
import { toCanonicalPath } from '../i18n/routes';
import LanguageSwitcher from './LanguageSwitcher';
import SearchBar from './SearchBar';
import { ChevronDownIcon } from './icons';
import { useTheme } from '../hooks/useTheme';
import { FEATURED_HOME_PROJECTS, FEATURED_HOME_TITLES } from '../data/home';
import { PROJECTS } from '../data/projects';

type NavItem = { to: string; labelKey: string; activeOn?: string[] };

const PACKAGES_ACTIVE = ['/haus-sanierung', '/wohnung-sanierung', '/gastronomie-ausbau', '/buero-ausbau'];
const TRADES_ACTIVE = ['/badsanierung', '/kuechen-moebelbau', '/boeden-belaege', '/elektroinstallation', '/trockenbau', '/maler-lackierer', '/fassadensanierung', '/abdichtung-keller', '/dachsanierung', '/treppen-gelaender', '/garten-aussenanlagen', '/barrierefreiheit', '/fenstertechnik', '/rohbau-abbruch', '/tueren-zargen', '/sanitaerinstallation', '/zaeune'];
const HEATING_ACTIVE = ['/heizkoerper', '/heizstraenge', '/fussbodenheizung', '/waermepumpe', '/gas-heizung', '/pelletofen', '/saunaofen'];

// The three categories grouped under the "Services" dropdown.
const SERVICE_ITEMS: NavItem[] = [
  { to: '/komplett-pakete', labelKey: 'nav.packages', activeOn: PACKAGES_ACTIVE },
  { to: '/gewerke', labelKey: 'nav.trades', activeOn: TRADES_ACTIVE },
  { to: '/heizmethoden', labelKey: 'nav.heating', activeOn: HEATING_ACTIVE },
];

// Standalone items after the Services dropdown (desktop order). "About us"
// is an in-page anchor to the founders section on the home page (same target
// the footer uses).
const TRAILING_NAV: NavItem[] = [
  { to: '/projekte', labelKey: 'nav.projects' },
  { to: '/blog', labelKey: 'nav.magazine' },
  { to: '/#ueber-uns', labelKey: 'nav.about' },
  { to: '/kontakt', labelKey: 'nav.contact' },
];

// Project spotlighted at the bottom of the mobile menu (first home highlight).
// Links to the project detail page when one exists.
const MENU_PROJECT = FEATURED_HOME_PROJECTS[0];
const MENU_PROJECT_ENTRY = PROJECTS.find((p) => p.src === MENU_PROJECT.src);
const MENU_PROJECT_LINK = MENU_PROJECT_ENTRY?.detail ? `/projekte/${MENU_PROJECT_ENTRY.slug}` : '/projekte';

function itemMatches(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/';
  if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return true;
  return item.activeOn?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { pathname: rawPathname } = useLocation();
  const pathname = toCanonicalPath(rawPathname);
  const servicesRef = useRef<HTMLLIElement>(null);
  const servicesCloseTimer = useRef<number>(0);

  useEffect(() => { setOpen(false); setServicesOpen(false); }, [rawPathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    const prevRoot = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = prevRoot;
    };
  }, [open]);

  // Hover open with a small close delay so the cursor can travel into the menu.
  const openServices = () => {
    window.clearTimeout(servicesCloseTimer.current);
    setServicesOpen(true);
  };
  const closeServicesSoon = () => {
    window.clearTimeout(servicesCloseTimer.current);
    servicesCloseTimer.current = window.setTimeout(() => setServicesOpen(false), 120);
  };
  useEffect(() => () => window.clearTimeout(servicesCloseTimer.current), []);

  const servicesActive = SERVICE_ITEMS.some((item) => itemMatches(item, pathname));

  const homeClick = (to: string) => {
    if (pathname === to || (to === '/' && pathname === '/')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="pv-contact-bar">
        <a href={businessContact.primary.telHref}>
          <span>{t('contact.primary')}:</span> <strong>{businessContact.primary.display}</strong>
        </a>
      </div>
      <header className={`pv-header${open ? ' is-menu-open' : ''}`}>
        <div className="pv-header__inner">
          <Link
            className="pv-logo"
            to="/"
            aria-label={t('header.logoAria')}
            onClick={() => homeClick('/')}
          >
            <img src="/assets/img/logo.png" alt="" width="1085" height="1051" />
            <span className="pv-logo__txt">
              <span className="pv-logo__name">Prima Vista</span>
              <span className="pv-logo__tag">Bauprojekte</span>
            </span>
          </Link>
          <nav className="pv-nav" aria-label={t('nav.ariaPrimary')}>
            <ul className="pv-nav__list">
              <li>
                <NavLink to="/" end className={pathname === '/' ? 'is-active' : ''} onClick={() => homeClick('/')}>
                  {t('nav.home')}
                </NavLink>
              </li>

              <li
                className={`pv-nav__has-menu${servicesOpen ? ' is-open' : ''}`}
                ref={servicesRef}
                onMouseEnter={openServices}
                onMouseLeave={closeServicesSoon}
                onBlur={(e) => {
                  if (!servicesRef.current?.contains(e.relatedTarget as Node)) setServicesOpen(false);
                }}
              >
                <button
                  type="button"
                  className={`pv-nav__menu-trigger${servicesActive ? ' is-active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={servicesOpen}
                  onClick={() => setServicesOpen((v) => !v)}
                >
                  {t('nav.services')}
                  <ChevronDownIcon className="pv-nav__chevron" aria-hidden="true" />
                </button>
                <ul className="pv-nav__menu" aria-label={t('nav.servicesMenuAria')}>
                  {SERVICE_ITEMS.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={itemMatches(item, pathname) ? 'is-active' : ''}
                        onClick={() => setServicesOpen(false)}
                      >
                        {t(item.labelKey)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              {TRAILING_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={itemMatches(item, pathname) ? 'is-active' : ''}
                    onClick={() => homeClick(item.to)}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>

            <SearchBar className="pv-nav__search pv-search--header" />

            <LanguageSwitcher className="pv-nav__lang" />
            <button
              type="button"
              className="pv-theme-toggle"
              aria-label={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? t('header.themeLightTitle') : t('header.themeDarkTitle')}
              onClick={toggleTheme}
            >
              <span className="pv-theme-toggle__track" aria-hidden="true">
                <span className="pv-theme-toggle__sun" />
                <span className="pv-theme-toggle__moon" />
                <span className="pv-theme-toggle__knob" />
              </span>
            </button>
          </nav>
          <div className="pv-header__actions">
            <Link className="btn btn--light pv-header__cta" to="/blitz-angebot">
              {t('cta.expressQuote')} <span className="arrow">&gt;</span>
            </Link>
            <button
              type="button"
              className={`pv-burger${open ? ' is-open' : ''}`}
              aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
              aria-expanded={open}
              aria-controls="pv-mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="pv-mobile-menu"
        className={`pv-mobile-menu${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.ariaPrimary')}
        hidden={!open}
      >
        <Link to={MENU_PROJECT_LINK} className="pv-mobile-menu__featured" onClick={() => setOpen(false)}>
          <img
            src={MENU_PROJECT.src}
            alt={t(`home:featured.projects.${MENU_PROJECT.gridClass}.alt`, { defaultValue: MENU_PROJECT.alt })}
            width={MENU_PROJECT.width}
            height={MENU_PROJECT.height}
            loading="lazy"
          />
          <span className="pv-mobile-menu__featured-cap">
            <span className="pv-mobile-menu__featured-eyebrow">{t('mobileMenu.focus')}</span>
            <span className="pv-mobile-menu__featured-row">
              <span className="pv-mobile-menu__featured-ttl">
                {t(`home:featured.projects.${MENU_PROJECT.gridClass}.ttl`, { defaultValue: FEATURED_HOME_TITLES[MENU_PROJECT.gridClass] })}
              </span>
              <span className="pv-mobile-menu__featured-yr">{MENU_PROJECT.year}</span>
            </span>
            <span className="pv-mobile-menu__featured-more">
              {t('cta.learnMore')} <span className="arrow">&gt;</span>
            </span>
          </span>
        </Link>

        <nav className="pv-mobile-menu__nav" aria-label={t('nav.ariaMobile')}>
          <ul className="pv-mobile-menu__list">
            <li style={{ ['--i' as string]: 0 }}>
              <NavLink
                to="/"
                end
                className={`pv-mobile-menu__link${pathname === '/' ? ' is-active' : ''}`}
                onClick={() => {
                  homeClick('/');
                  setOpen(false);
                }}
              >
                <span className="pv-mobile-menu__label">{t('nav.home')}</span>
                <span className="pv-mobile-menu__num">01</span>
              </NavLink>
            </li>
            <li className={`pv-mobile-menu__group${servicesActive ? ' is-active' : ''}`} style={{ ['--i' as string]: 1 }}>
              <div className="pv-mobile-menu__group-head">
                <span className="pv-mobile-menu__label">{t('nav.services')}</span>
                <span className="pv-mobile-menu__num">02</span>
              </div>
              <div className="pv-mobile-menu__subgrid">
                {SERVICE_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`pv-mobile-menu__sublink${itemMatches(item, pathname) ? ' is-active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            </li>
            {TRAILING_NAV.map((item, i) => {
              const active = itemMatches(item, pathname);
              const number = String(i + 3).padStart(2, '0');
              return (
              <li
                key={item.to}
                data-mobile-nav={item.to.replace(/^\/#?/, '') || 'home'}
                style={{ ['--i' as string]: i + 2 }}
              >
                <NavLink
                  to={item.to}
                  className={`pv-mobile-menu__link${active ? ' is-active' : ''}`}
                  onClick={() => {
                    homeClick(item.to);
                    setOpen(false);
                  }}
                >
                  <span className="pv-mobile-menu__label">{t(item.labelKey)}</span>
                  <span className="pv-mobile-menu__num">{number}</span>
                </NavLink>
              </li>
              );
            })}
          </ul>
        </nav>

        <div className="pv-mobile-menu__foot">
          <ContactNumbers />
          <div className="pv-mobile-menu__controls">
            <LanguageSwitcher className="pv-lang--mobile pv-mobile-menu__lang" />
            <button
              type="button"
              className="pv-theme-toggle pv-theme-toggle--mobile"
              aria-label={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? t('header.themeLightTitle') : t('header.themeDarkTitle')}
              onClick={toggleTheme}
            >
              <span className="pv-theme-toggle__track" aria-hidden="true">
                <span className="pv-theme-toggle__sun" />
                <span className="pv-theme-toggle__moon" />
                <span className="pv-theme-toggle__knob" />
              </span>
              <span className="pv-mobile-menu__control-label">
                {theme === 'dark' ? t('header.themeLightTitle') : t('header.themeDarkTitle')}
              </span>
            </button>
          </div>
          <Link to="/blitz-angebot" className="btn btn--appointment btn--shimmer pv-mobile-menu__cta" onClick={() => setOpen(false)}>
            {t('cta.expressQuote')} <span className="arrow">&gt;</span>
          </Link>
        </div>
      </div>
    </>
  );
}

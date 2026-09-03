import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import Header from './Header';
import Footer from './Footer';
import SocialRail from './SocialRail';
import BookingFloat from './BookingFloat';
import AdminBackFloat from './AdminBackFloat';
import ScrollDownFloat from './ScrollDownFloat';
import Chat from './Chat';
import CookieConsent from './CookieConsent';
import { LightboxProvider } from './Lightbox';
import { useReveal } from '../hooks/useReveal';
import { hasAnalyticsConsent, useConsent } from '../hooks/useConsent';
import { getRouteMeta } from '../data/routeMeta';
import { setPageMeta } from '../utils/metadata';
import LocaleSync from '../i18n/LocaleSync';
import { localeFromPathname, toCanonicalPath } from '../i18n/routes';
import {
  hasGoogleAnalyticsConfig,
  trackGoogleAnalyticsContactClick,
  trackGoogleAnalyticsPageView,
  updateGoogleAnalyticsConsent,
} from '../utils/googleAnalytics';

const DESKTOP_MEDIA = '(min-width: 1081px) and (hover: hover) and (pointer: fine)';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_MEDIA).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { hash, key, pathname, search, state } = location;
  const lastScrollByKey = useRef<Record<string, number>>({});
  const lastScrollByPath = useRef<Record<string, number>>({});
  const pathKey = `${pathname}${search}`;
  const currentKey = useRef(key);
  const currentPathKey = useRef(pathKey);

  const readSavedScroll = (storageKey: string) => {
    try {
      const value = window.sessionStorage.getItem(storageKey);
      if (value === null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeSavedScroll = (storageKey: string, scrollY: number) => {
    try {
      window.sessionStorage.setItem(storageKey, String(scrollY));
    } catch {
      // Scroll restoration is a convenience; navigation must never depend on storage.
    }
  };

  const writeScrollState = (scrollY: number) => {
    try {
      window.history.replaceState(
        { ...(window.history.state ?? {}), pvScrollY: scrollY },
        document.title,
      );
    } catch {
      // Keep the sessionStorage fallback when history state is unavailable.
    }
  };

  useLayoutEffect(() => {
    currentKey.current = key;
    currentPathKey.current = pathKey;
  }, [key, pathKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.scrollRestoration = 'manual';

    const saveCurrentScroll = () => {
      lastScrollByKey.current[currentKey.current] = window.scrollY;
      lastScrollByPath.current[currentPathKey.current] = window.scrollY;
      writeScrollState(window.scrollY);
      writeSavedScroll(`scroll:${currentKey.current}`, window.scrollY);
      writeSavedScroll(`scroll:${currentPathKey.current}`, window.scrollY);
    };

    window.addEventListener('pagehide', saveCurrentScroll);

    return () => {
      saveCurrentScroll();
      window.removeEventListener('pagehide', saveCurrentScroll);
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  useEffect(() => {
    let timer = 0;

    // Expensive: history.replaceState + sessionStorage writes. Kept OUT of the
    // per-scroll path — running these on every scroll event stuttered badly on
    // touch devices.
    const persist = () => {
      timer = 0;
      const y = window.scrollY;
      writeScrollState(y);
      writeSavedScroll(`scroll:${key}`, y);
      writeSavedScroll(`scroll:${pathKey}`, y);
    };

    // Cheap: update in-memory refs on every scroll, but debounce the costly
    // persistence to once scrolling settles. The latest position is always in
    // the refs and is flushed on unmount / pagehide regardless.
    const onScroll = () => {
      const y = window.scrollY;
      lastScrollByKey.current[key] = y;
      lastScrollByPath.current[pathKey] = y;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(persist, 200);
    };

    if (navigationType !== 'POP') {
      lastScrollByKey.current[key] = window.scrollY;
      lastScrollByPath.current[pathKey] = window.scrollY;
      persist();
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (timer) window.clearTimeout(timer);
      persist();
      window.removeEventListener('scroll', onScroll);
    };
  }, [key, navigationType, pathKey]);

  useLayoutEffect(() => {
    if (hash) {
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        target?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (state && state.targetId) {
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(state.targetId);
        if (target) {
          // Force all reveal elements to be visible instantly to prevent a sluggish feeling
          document.querySelectorAll('.reveal, .reveal-group').forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.transition = 'none';
            htmlEl.style.animation = 'none';
            htmlEl.classList.add('is-in');
          });
          target.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          
          // Cleanup inline styles after a moment so future reveals work
          setTimeout(() => {
            document.querySelectorAll('.reveal, .reveal-group').forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.transition = '';
              htmlEl.style.animation = '';
            });
          }, 50);
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (navigationType === 'POP') {
      let cancelled = false;
      const timers: number[] = [];
      // The moment the user scrolls/taps, stop forcing the saved position —
      // otherwise the late retries below yank the page back under them.
      const stop = () => {
        cancelled = true;
        timers.forEach((t) => window.clearTimeout(t));
        timers.length = 0;
        window.removeEventListener('wheel', stop);
        window.removeEventListener('touchstart', stop);
        window.removeEventListener('keydown', stop);
      };

      const frame = window.requestAnimationFrame(() => {
        const storedScroll = readSavedScroll(`scroll:${key}`);
        const storedPathScroll = readSavedScroll(`scroll:${pathKey}`);
        const historyScroll = window.history.state?.pvScrollY;
        const savedScroll = (typeof historyScroll === 'number' && Number.isFinite(historyScroll) ? historyScroll : null)
          ?? lastScrollByKey.current[key]
          ?? storedScroll
          ?? lastScrollByPath.current[pathKey]
          ?? storedPathScroll
          ?? 0;
        const restore = () => {
          if (cancelled) return;
          window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
        };

        const restoreWhenReady = (attempt = 0) => {
          if (cancelled) return;
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          if (savedScroll <= maxScroll || attempt > 12) {
            restore();
            return;
          }
          window.requestAnimationFrame(() => restoreWhenReady(attempt + 1));
        };

        restoreWhenReady();
        if (savedScroll > 0) {
          // Late retries catch content that grows after first layout (e.g.
          // images), so restoration stays reliable — but they bail out the
          // instant the user scrolls/taps, so they never yank the page back.
          window.addEventListener('wheel', stop, { passive: true });
          window.addEventListener('touchstart', stop, { passive: true });
          window.addEventListener('keydown', stop);
          timers.push(window.setTimeout(restore, 100));
          timers.push(window.setTimeout(restore, 300));
          timers.push(window.setTimeout(restore, 700));
          timers.push(window.setTimeout(() => { restore(); stop(); }, 1200));
        }
      });
      return () => {
        window.cancelAnimationFrame(frame);
        stop();
      };
    }

    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [hash, key, navigationType, pathKey, pathname, state]);

  return null;
}

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const canonical = toCanonicalPath(pathname);
    const locale = localeFromPathname(pathname);
    const meta = getRouteMeta(canonical, locale);
    setPageMeta({ ...meta, canonical, locale });
  }, [pathname]);

  return null;
}

function GoogleAnalyticsTracker() {
  const consent = useConsent();
  const location = useLocation();
  const hasTrackedPath = useRef('');
  const analyticsAllowed = hasAnalyticsConsent(consent);
  const pagePath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    document.addEventListener('click', trackGoogleAnalyticsContactClick);
    return () => document.removeEventListener('click', trackGoogleAnalyticsContactClick);
  }, []);

  useEffect(() => {
    if (!hasGoogleAnalyticsConfig()) return;
    updateGoogleAnalyticsConsent(analyticsAllowed);
  }, [analyticsAllowed]);

  useEffect(() => {
    if (!hasGoogleAnalyticsConfig() || !analyticsAllowed) return;
    if (hasTrackedPath.current === pagePath) return;

    hasTrackedPath.current = pagePath;
    trackGoogleAnalyticsPageView(pagePath);
  }, [analyticsAllowed, pagePath]);

  return null;
}

export default function Layout() {
  useReveal();
  const isDesktop = useIsDesktop();
  return (
    <LightboxProvider>
      <LocaleSync />
      <RouteMetadata />
      <GoogleAnalyticsTracker />
      <ScrollToTop />
      <Header />
      <main>
        <Outlet />
      </main>
      <SocialRail />
      <BookingFloat />
      <ScrollDownFloat />
      <AdminBackFloat />
      {isDesktop && <Chat />}
      <CookieConsent />
      <Footer />
    </LightboxProvider>
  );
}

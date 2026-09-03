import { useEffect, useState } from 'react';

export const CONSENT_STORAGE_KEY = 'pv-cookie-consent-v1';
/** Fired whenever the user saves a consent choice. detail = ConsentPayload */
export const CONSENT_EVENT = 'pv-cookie-consent';
/** Fired to programmatically re-open the consent banner. */
export const CONSENT_OPEN_EVENT = 'pv-cookie-open';

export type ConsentChoice = 'necessary' | 'all';

export type ConsentPayload = {
  choice: ConsentChoice;
  analytics: boolean;
  chatbot: boolean;
  youtube: boolean;
  savedAt: string;
};

export function readConsent(): ConsentPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentPayload;
  } catch {
    return null;
  }
}

/** True once the user has accepted optional/third-party media (YouTube). */
export function hasYouTubeConsent(consent: ConsentPayload | null): boolean {
  if (!consent) return false;
  // Tolerate older stored payloads that predate the `youtube` flag.
  return consent.youtube === true || consent.choice === 'all';
}

/** True once the user has accepted analytics cookies/tracking. */
export function hasAnalyticsConsent(consent: ConsentPayload | null): boolean {
  if (!consent) return false;
  // Tolerate older stored payloads that predate the `analytics` flag.
  return consent.analytics === true || consent.choice === 'all';
}

/** Re-open the cookie banner so the user can grant consent. */
export function openConsentBanner() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

/** Reactive read of the current consent state; updates on save. */
export function useConsent(): ConsentPayload | null {
  const [consent, setConsent] = useState<ConsentPayload | null>(() => readConsent());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConsentPayload>).detail;
      setConsent(detail ?? readConsent());
    };
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);

  return consent;
}

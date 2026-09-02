import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GA_ID = 'G-TEST123456';
let storedConsent: string | null;
let analytics: typeof import('../../src/utils/googleAnalytics');
const gtag = vi.fn();
const appendScript = vi.fn();

// A small DOM double suffices; no third-party script or browser is launched.
class LinkTarget {
  constructor(private href: string | null) {}
  closest(selector: string) {
    return selector === 'a[href]' && this.href ? this : null;
  }
  getAttribute(name: string) {
    return name === 'href' ? this.href : null;
  }
}

function consent(allowed: boolean) {
  storedConsent = JSON.stringify({ choice: allowed ? 'all' : 'necessary', analytics: allowed });
}

function eventCalls(name?: string) {
  return gtag.mock.calls.filter(([command, event]) => command === 'event' && (!name || name === event));
}

function click(href: string | null, extra: Partial<MouseEvent> = {}) {
  analytics.trackGoogleAnalyticsContactClick({
    target: new LinkTarget(href), button: 0, defaultPrevented: false, ...extra,
  } as unknown as MouseEvent);
}

beforeEach(async () => {
  vi.resetModules();
  gtag.mockReset();
  appendScript.mockReset();
  storedConsent = null;
  vi.stubEnv('VITE_GOOGLE_ANALYTICS_ID', GA_ID);
  vi.stubGlobal('window', {
    location: new URL('https://www.primavista-bauprojekte.com/kontakt?email=private@example.com#private-message'),
    localStorage: { getItem: () => storedConsent },
    gtag,
  });
  vi.stubGlobal('document', {
    title: 'Private Person',
    referrer: 'https://example.com/?phone=4912345678',
    getElementById: () => null,
    createElement: () => ({}),
    head: { append: appendScript },
  });
  vi.stubGlobal('Element', LinkTarget);
  analytics = await import('../../src/utils/googleAnalytics');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('consented enquiry tracking', () => {
  it('does not load or emit anything without analytics consent', () => {
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, {});
    click('tel:+4912345678');
    expect(gtag).not.toHaveBeenCalled();
    expect(appendScript).not.toHaveBeenCalled();
  });

  it('fails closed for necessary-only, malformed or inaccessible consent', () => {
    for (const value of [JSON.stringify({ choice: 'necessary', analytics: false }), '{broken']) {
      storedConsent = value;
      analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, {});
      click('https://wa.me/4912345678');
    }
    window.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    analytics.trackGoogleAnalyticsLead('calculator', { ok: true }, { ok: true }, {});
    expect(gtag).not.toHaveBeenCalled();
  });

  it('sends only a fixed label to the explicit GA4 destination after acknowledged success', () => {
    consent(true);
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, {
      ok: true, name: 'Private Person', email: 'private@example.com', phone: '4912345678',
      address: 'Private Street 7', message: 'private-message',
    }, {});
    expect(eventCalls()).toEqual([['event', 'generate_lead', {
      send_to: GA_ID,
      page_location: 'https://www.primavista-bauprojekte.com/kontakt',
      page_referrer: '',
      page_title: 'Prima Vista Bauprojekte',
      form_name: 'contact',
    }]]);
    expect(JSON.stringify(eventCalls())).not.toMatch(/Private Person|private@example|4912345678|Private Street|private-message|\?|#/);
  });

  it('accepts all three fixed enquiry forms, but rejects unapproved labels', () => {
    consent(true);
    for (const form of ['contact', 'quote', 'calculator'] as const) {
      analytics.trackGoogleAnalyticsLead(form, { ok: true }, { ok: true, duplicate: false }, {});
    }
    analytics.trackGoogleAnalyticsLead('private@example.com' as 'contact', { ok: true }, { ok: true }, {});
    expect(eventCalls('generate_lead').map((call) => call[2].form_name)).toEqual(['contact', 'quote', 'calculator']);
  });

  it('rejects HTTP failure, missing acknowledgement, rejected/spam and duplicate responses', () => {
    consent(true);
    analytics.trackGoogleAnalyticsLead('contact', { ok: false }, { ok: true }, {});
    for (const result of [null, {}, { ok: false }, { ok: true, spam: true }, { ok: true, duplicate: true }]) {
      analytics.trackGoogleAnalyticsLead('contact', { ok: true }, result, {});
    }
    for (const result of [{ ok: true }, { ok: true, duplicate: 'false' }, { ok: true, duplicate: true }]) {
      analytics.trackGoogleAnalyticsLead('quote', { ok: true }, result, {});
    }
    expect(gtag).not.toHaveBeenCalled();
  });

  it('counts a completed form flow once, but permits a retry after a rejected response', () => {
    consent(true);
    const submission = {};
    analytics.trackGoogleAnalyticsLead('contact', { ok: false }, { ok: false }, submission);
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, submission);
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, submission);
    expect(eventCalls('generate_lead')).toHaveLength(1);
  });

  it('rechecks consent when an in-flight request completes, including before React rerenders', () => {
    consent(true);
    analytics.updateGoogleAnalyticsConsent(true);
    consent(false);
    analytics.trackGoogleAnalyticsLead('quote', { ok: true }, { ok: true, duplicate: false }, {});
    click('tel:+4912345678');
    analytics.updateGoogleAnalyticsConsent(false);
    analytics.trackGoogleAnalyticsLead('calculator', { ok: true }, { ok: true }, {});
    expect(eventCalls()).toHaveLength(0);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'denied' });
  });

  it('does not replay a completed unconsented flow after consent is granted', () => {
    const submission = {};
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, submission);
    consent(true);
    analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, submission);
    expect(eventCalls()).toHaveLength(0);
  });

  it('isolates optional analytics failures from successful enquiry handling', () => {
    consent(true);
    gtag.mockImplementation(() => { throw new Error('Blocked analytics'); });
    expect(() => analytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, {})).not.toThrow();
  });

  it('does not initialise tracking when the deployment disables its ID', async () => {
    consent(true);
    vi.stubEnv('VITE_GOOGLE_ANALYTICS_ID', '');
    vi.resetModules();
    const disabledAnalytics = await import('../../src/utils/googleAnalytics');
    disabledAnalytics.trackGoogleAnalyticsLead('contact', { ok: true }, { ok: true }, {});
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('contact-click intent stays separate from leads', () => {
  it('tracks telephone and WhatsApp without sending the destination or contact details', () => {
    consent(true);
    click('tel:+4912345678');
    click('https://wa.me/4912345678?text=private-message');
    click('https://api.whatsapp.com/send?phone=4912345678&text=private-message');
    click('whatsapp://send?phone=4912345678');
    expect(eventCalls('generate_lead')).toHaveLength(0);
    expect(eventCalls('contact_click').map((call) => call[2].contact_method)).toEqual([
      'phone', 'whatsapp', 'whatsapp', 'whatsapp',
    ]);
    expect(JSON.stringify(eventCalls())).not.toMatch(/4912345678|private-message|wa\.me|whatsapp\.com|\?|#/);
    for (const [, , parameters] of eventCalls()) expect(parameters.send_to).toBe(GA_ID);
  });

  it('ignores unrelated, prevented and non-primary clicks', () => {
    consent(true);
    click('/kontakt');
    click('mailto:private@example.com');
    click('https://wa.me.evil.example/4912345678');
    click('tel:+4912345678', { defaultPrevented: true });
    click('tel:+4912345678', { button: 2 });
    click(null);
    expect(gtag).not.toHaveBeenCalled();
  });
});

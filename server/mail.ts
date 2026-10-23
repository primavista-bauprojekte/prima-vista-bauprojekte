/**
 * Email sending via Resend — shared by both Netlify functions and the
 * Vite dev middleware. Two flows are supported: contact form (KontaktForm)
 * and Blitzangebot (BlitzForm). Each flow sends a notification email to
 * the office and a confirmation email back to the customer.
 */

import { Resend } from 'resend';
import { businessContact } from '../shared/contact.js';
import { buildCalculatorPdf, type CalculatorPdfPayload } from './calculatorPdf.js';
import type { BlitzEstimate } from './blitzEstimate.js';
import {
  type Locale,
  artLabel as artLabelFor,
  gewerkeLabel,
  kontaktArtLabel,
  starterminLabel as starterminLabelFor,
  terminArtLabel,
  formatDateLong,
  formatEuro as formatEuroFor,
  formatQuantity as formatQuantityFor,
  interpolate,
  normalizeLocale,
  tt,
} from './i18n.js';
import { consultationEndTime } from './terminAvailability.js';

const FROM = process.env.MAIL_FROM ?? 'Prima Vista Bauprojekte <noreply@primavista-bauprojekte.com>';
const TO_OFFICE = process.env.MAIL_TO_OFFICE ?? 'office@primavista-bauprojekte.com';

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not configured');
    resendClient = new Resend(key);
  }
  return resendClient;
}

type ResendSendResult = Awaited<ReturnType<Resend['emails']['send']>>;

// Resend's fetch client (v6) accepts no AbortSignal, so bound each call by
// racing it against a timeout. Keeps a stalled upstream from burning the whole
// function wall-clock — the rejection lands in the route's try/catch and yields
// a clean 502 instead of a hard platform kill.
const RESEND_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function ensureEmailSent(result: ResendSendResult, context: string): void {
  if (!result.error) return;
  const detail = `${result.error.name}: ${result.error.message}`;
  throw new Error(`Resend ${context} email failed (${detail})`);
}

async function sendEmail(payload: Parameters<Resend['emails']['send']>[0], context: string): Promise<void> {
  // Dev/test escape hatch: log instead of sending, so the full flow can be
  // exercised without a Resend key and without emailing real people.
  if (process.env.MAIL_DRY_RUN === '1') {
    console.log(`[mail] DRY RUN — "${context}" → ${String(payload.to)} · ${payload.subject}`);
    return;
  }
  const result = await withTimeout(getResend().emails.send(payload), RESEND_TIMEOUT_MS, `Resend ${context}`);
  ensureEmailSent(result, context);
}

const COLORS = {
  ink: '#1a1a1a',
  bg: '#f6f3ef',           // cream
  card: '#ffffff',
  muted: '#5a5a5a',
  copper: '#c89a6a',
  red: '#b61d1a',
  rule: 'rgba(26, 26, 26, 0.12)',
};

// ----- Type definitions -----

export type KontaktPayload = {
  vorname: string;
  nachname: string;
  email: string;
  tel?: string;
  art?: string;
  region?: string;
  budget?: string;
  msg: string;
  /** Preferred consultation date (ISO yyyy-mm-dd) — a preference, not a booking. */
  wunschtermin?: string;
  terminZeit?: string;
  terminArt?: string;
  terminAlternativ?: string;
  terminAlternativZeit?: string;
  /** Request locale — localizes the CUSTOMER confirmation only. Defaults 'de'. */
  locale?: Locale;
};

export type BlitzPayload = {
  art: string;
  artLabel: string;
  groesse: string;
  starttermin: string;
  starterminLabel: string;
  gewerke: string[];
  msg: string;
  kalkulator?: KalkulatorHandoff | null;
  name: string;
  email: string;
  tel: string;
  /** GDPR/email consent checkbox — required for the automatic estimate. */
  dsgvo?: boolean;
  /** Request locale — localizes the CUSTOMER confirmation only. Defaults 'de'. */
  locale?: Locale;
};

export type KalkulatorRow = {
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  sku?: string;
  description?: string;
  image?: string;
  category?: string;
  subcategory?: string;
  type?: string;
};

export type KalkulatorPick = {
  key: string;
  label: string;
  subtotal: number;
  sku?: string;
  description?: string;
  image?: string;
  category?: string;
  subcategory?: string;
  type?: string;
  tradeKey?: string;
  tradeLabel?: string;
  rows?: KalkulatorRow[];
};

export type KalkulatorHandoff = {
  kind: string;
  kindLabel: string;
  scopeLabel?: string;
  area: number;
  picks: KalkulatorPick[];
  totalMin: number;
  totalMax: number;
  totalMid: number;
  perM2: number;
};

type KalkulatorGroup = {
  key: string;
  label: string;
  subtotal: number;
  items: KalkulatorPick[];
};

// ----- Helpers -----

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nl2br = (s: string) => escape(s).replace(/\n/g, '<br />');

function businessPhoneText(locale: Locale): string {
  return `${tt(locale, 'contactPrimaryLabel')}: ${businessContact.primary.display}\n${tt(locale, 'contactSecondaryLabel')}: ${businessContact.secondary.display}`;
}

function shell(title: string, eyebrow: string, body: string, locale: Locale = 'de'): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Georgia, 'Times New Roman', serif;color:${COLORS.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${COLORS.card};">
<tr><td style="padding:40px 40px 8px 40px;">
<div style="font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">
<span style="display:inline-block;width:28px;height:2px;background:${COLORS.red};vertical-align:middle;margin-right:10px;"></span>${escape(eyebrow)}
</div>
</td></tr>
<tr><td style="padding:12px 40px 0 40px;">
<h1 style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-style:italic;font-weight:500;font-size:30px;line-height:1.15;color:${COLORS.ink};">${title}</h1>
</td></tr>
<tr><td style="padding:24px 40px 40px 40px;">
${body}
</td></tr>
<tr><td style="padding:20px 40px;background:${COLORS.bg};border-top:1px solid ${COLORS.rule};">
<div style="font-family:Helvetica, Arial, sans-serif;font-size:11px;color:${COLORS.muted};line-height:1.6;">
Prima Vista Bauprojekte · Gref-Völsing-Straße 13, 60314 Frankfurt am Main<br />
${escape(tt(locale, 'contactPrimaryLabel'))}: <a href="${businessContact.primary.telHref}" style="color:${COLORS.copper};text-decoration:none;">${businessContact.primary.display}</a><br />
${escape(tt(locale, 'contactSecondaryLabel'))}: <a href="${businessContact.secondary.telHref}" style="color:${COLORS.copper};text-decoration:none;">${businessContact.secondary.display}</a><br />
<a href="https://primavista-bauprojekte.com" style="color:${COLORS.copper};text-decoration:none;">primavista-bauprojekte.com</a>
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function row(label: string, value: string | undefined | null): string {
  if (!value) return '';
  return `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;width:140px;font-family:Helvetica, Arial, sans-serif;font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.muted};">${escape(label)}</td>
<td style="padding:10px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:1.5;color:${COLORS.ink};">${nl2br(value)}</td>
</tr>`;
}

function bodyParagraph(text: string): string {
  return `<p style="margin:0 0 16px 0;font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:1.6;color:${COLORS.ink};">${nl2br(text)}</p>`;
}

function sectionTitle(label: string, marginTop = 32): string {
  return `<h2 style="margin:${marginTop}px 0 12px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(label)}</h2>`;
}

function callout(title: string, text: string): string {
  return `<div style="margin:24px 0 0 0;padding:16px 18px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;color:${COLORS.ink};border-left:3px solid ${COLORS.copper};">
<div style="margin:0 0 6px 0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${COLORS.copper};">${escape(title)}</div>
<p style="margin:0;font-size:13px;line-height:1.55;color:${COLORS.muted};">${nl2br(text)}</p>
</div>`;
}

function serviceListHtml(items: string[], emptyLabel: string): string {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);
  if (cleanItems.length === 0) {
    return bodyParagraph(emptyLabel);
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;border-top:1px solid ${COLORS.rule};">
${cleanItems
    .map((item, index) => `<tr>
<td style="padding:12px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;width:34px;font-family:Helvetica, Arial, sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;color:${COLORS.copper};">${String(index + 1).padStart(2, '0')}</td>
<td style="padding:12px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:1.45;color:${COLORS.ink};">${escape(item)}</td>
</tr>`)
    .join('')}
</table>`;
}

function serviceListText(items: string[], emptyLabel: string): string {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);
  if (cleanItems.length === 0) return `· ${emptyLabel}`;
  return cleanItems.map((item) => `· ${item}`).join('\n');
}

// Localize the canonical German gewerke codes for the customer email; the
// office email passes locale 'de' so the labels stay German.
function localizedGewerke(items: string[], locale: Locale): string[] {
  return items.map((item) => gewerkeLabel(locale, item.trim()));
}

// Office (German) renderers call these with the default `de`; customer
// renderers pass the request locale so currency/number/unit formatting matches.
function formatEuro(value: number, locale: Locale = 'de'): string {
  return formatEuroFor(value, locale);
}

function formatQuantity(quantity: number, unit: string, locale: Locale = 'de'): string {
  return formatQuantityFor(quantity, unit, locale);
}

function cleanCalculatorLabel(label: string): string {
  return label
    .replace(/[🛠🔧]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\|/g, ' |')
    .replace(/\|\s+/g, '| ')
    .trim();
}

function blitzScopeLabel(p: BlitzPayload, locale: Locale = 'de'): string {
  return p.art === 'pakete' ? tt(locale, 'scopeArea') : tt(locale, 'scopeExtent');
}

function blitzScopeValue(p: BlitzPayload): string {
  const value = p.groesse || 'Noch offen';
  return p.art === 'pakete' ? `${value} m²` : value;
}

// The scope LABEL is localized for the customer; the German scopeLabel keyword
// detection (below) always runs against the German form, so it must not depend
// on the localized label.
function calculatorScopeLabel(p: BlitzPayload, locale: Locale = 'de'): string {
  return p.kalkulator?.scopeLabel
    || (p.art === 'pakete' ? tt(locale, 'scopeArea') : tt(locale, 'scopeAreaOrExtent'));
}

function calculatorScopeValue(p: BlitzPayload, handoff: KalkulatorHandoff, locale: Locale = 'de'): string {
  if (!Number.isFinite(handoff.area)) return blitzScopeValue(p);
  // Unit detection keys on the GERMAN scope label (scopeLabel from the handoff
  // or the German fallback), independent of the display locale.
  const label = calculatorScopeLabel(p, 'de').toLocaleLowerCase('de-DE');
  const amount = handoff.area.toLocaleString(localeTag(locale));
  if (/laufmeter|zaunlänge/.test(label)) return `${amount} m`;
  if (/qm|m²|fläche|wohnfläche|dachfläche|fassadenfläche/.test(label)) return `${amount} m²`;
  return amount;
}

function localeTag(locale: Locale): string {
  return locale === 'en' ? 'en-US' : locale === 'it' ? 'it-IT' : 'de-DE';
}

function isLegacyCalculatorNote(message: string): boolean {
  const normalized = message.toLocaleLowerCase('de-DE');
  return normalized.includes('aus dem kalkulator übernommen')
    || ((normalized.includes('kostenschätzung') || normalized.includes('vorab-schätzung'))
      && normalized.includes('gewählte gewerke'));
}

function legacyCalculatorField(message: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = message.match(new RegExp(`^\\s*${escapedLabel}\\s*:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() || null;
}

function legacyCalculatorEstimate(message: string): string | null {
  return legacyCalculatorField(message, 'Kostenschätzung')
    ?? legacyCalculatorField(message, 'Vorab-Schätzung');
}

function legacyCalculatorScope(message: string): { label: string; value: string } | null {
  const match = message.match(/^\s*(Fläche|Wohnfläche|Umfang|Anzahl|Dachfläche|Fassadenfläche|Zaunlänge)\s*:\s*(.+)$/im);
  if (!match?.[1] || !match[2]) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function cleanLegacyCalculatorNote(message: string): string {
  return message
    .replace(/^\s*[—-]\s*Aus dem Kalkulator übernommen\s*[—-]\s*$/im, 'Aus dem Kalkulator übernommen')
    .trim();
}

function hasCalculatorContext(p: BlitzPayload): boolean {
  return Boolean(p.kalkulator) || isLegacyCalculatorNote(p.msg);
}

function blitzRequestContext(p: BlitzPayload): string {
  if (p.kalkulator) return `${calculatorScopeValue(p, p.kalkulator)} ${p.kalkulator.kindLabel || p.artLabel}`;
  if (isLegacyCalculatorNote(p.msg)) {
    const kind = legacyCalculatorField(p.msg, 'Objektart') || p.artLabel;
    const scope = legacyCalculatorScope(p.msg)?.value || blitzScopeValue(p);
    return `${scope} ${kind}`.trim();
  }
  return `${blitzScopeValue(p)} ${p.artLabel}`.trim();
}

// `locale` localizes the row LABELS and enum-derived values for the customer
// email. The office email passes 'de' and keeps the German display labels the
// client submitted (p.artLabel / p.starterminLabel).
function blitzProjectRows(p: BlitzPayload, locale: Locale = 'de'): string {
  const isDe = locale === 'de';
  const artDisplay = isDe ? p.artLabel : artLabelFor(locale, p.art);
  const starttermin = isDe ? p.starterminLabel : starterminLabelFor(locale, p.starttermin);

  if (p.kalkulator) {
    return [
      row(tt(locale, 'rowRequest'), tt(locale, 'rowRequestValue')),
      row(tt(locale, 'rowCalculator'), p.kalkulator.kindLabel || artDisplay),
      row(calculatorScopeLabel(p, locale), calculatorScopeValue(p, p.kalkulator, locale)),
      row(tt(locale, 'rowEstimate'), `${formatEuro(p.kalkulator.totalMin, locale)} – ${formatEuro(p.kalkulator.totalMax, locale)}`),
      row(tt(locale, 'rowStart'), starttermin),
    ].join('');
  }

  if (isLegacyCalculatorNote(p.msg)) {
    const scope = legacyCalculatorScope(p.msg);
    return [
      row(tt(locale, 'rowRequest'), tt(locale, 'rowRequestValue')),
      row(tt(locale, 'rowCalculator'), legacyCalculatorField(p.msg, 'Objektart') || artDisplay),
      scope ? row(scope.label, scope.value) : row(blitzScopeLabel(p, locale), blitzScopeValue(p)),
      row(tt(locale, 'rowEstimate'), legacyCalculatorEstimate(p.msg)),
      row(tt(locale, 'rowStart'), starttermin),
    ].join('');
  }

  return [
    row(tt(locale, 'rowObjectType'), artDisplay),
    row(blitzScopeLabel(p, locale), blitzScopeValue(p)),
    row(tt(locale, 'rowStart'), starttermin),
  ].join('');
}

function blitzServiceSectionHtml(title: string, p: BlitzPayload, locale: Locale = 'de', marginTop = 28): string {
  if (p.gewerke.length === 0 && hasCalculatorContext(p)) return '';
  return `${sectionTitle(title, marginTop)}${serviceListHtml(localizedGewerke(p.gewerke, locale), tt(locale, 'emptyPreselection'))}`;
}

function blitzServiceSectionText(title: string, p: BlitzPayload, locale: Locale = 'de'): string {
  if (p.gewerke.length === 0 && hasCalculatorContext(p)) return '';
  return `\n${title}:\n${serviceListText(localizedGewerke(p.gewerke, locale), tt(locale, 'emptyPreselection'))}`;
}

function legacyCalculatorBlockHtml(p: BlitzPayload, heading: string): string {
  if (p.kalkulator || !isLegacyCalculatorNote(p.msg)) return '';
  return `
${sectionTitle(heading)}
<div style="margin:0 0 18px 0;padding:16px 18px;background:${COLORS.bg};border-left:3px solid ${COLORS.copper};">
${bodyParagraph(cleanLegacyCalculatorNote(p.msg))}
</div>`;
}

function groupCalculatorPicks(picks: KalkulatorPick[]): KalkulatorGroup[] {
  const groups: KalkulatorGroup[] = [];
  const byKey = new Map<string, KalkulatorGroup>();
  let lastGroup: KalkulatorGroup | null = null;

  function push(group: KalkulatorGroup, pick: KalkulatorPick) {
    group.items.push(pick);
    group.subtotal += pick.subtotal;
    lastGroup = group;
  }

  for (const pick of picks) {
    if (pick.tradeKey) {
      let group = byKey.get(pick.tradeKey);
      if (!group) {
        group = {
          key: pick.tradeKey,
          label: pick.tradeLabel ?? pick.label,
          subtotal: 0,
          items: [],
        };
        byKey.set(pick.tradeKey, group);
        groups.push(group);
      }
      push(group, pick);
    } else if (lastGroup) {
      push(lastGroup, pick);
    } else {
      const group: KalkulatorGroup = {
        key: `_${pick.key}`,
        label: pick.label,
        subtotal: 0,
        items: [],
      };
      groups.push(group);
      push(group, pick);
    }
  }

  return groups;
}

function calculatorSummaryHtml(p: BlitzPayload, handoff: KalkulatorHandoff, locale: Locale = 'de'): string {
  const artDisplay = locale === 'de' ? p.artLabel : artLabelFor(locale, p.art);
  const summaryRows = [
    row(tt(locale, 'rowObjectType'), handoff.kindLabel || artDisplay),
    row(calculatorScopeLabel(p, locale), calculatorScopeValue(p, handoff, locale)),
    row(tt(locale, 'rowEstimate'), `${formatEuro(handoff.totalMin, locale)} – ${formatEuro(handoff.totalMax, locale)}`),
    row(tt(locale, 'rowMid'), formatEuro(handoff.totalMid, locale)),
    handoff.perM2 > 0 ? row(tt(locale, 'rowGuideValue'), `${formatEuro(handoff.perM2, locale)} / m²`) : '',
  ].join('');

  return `
<div style="margin:24px 0;padding:18px 20px;background:${COLORS.bg};border-left:3px solid ${COLORS.copper};">
  <div style="font-family:Helvetica, Arial, sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.copper};margin-bottom:10px;">${escape(tt(locale, 'calcFromCalculator'))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${summaryRows}</table>
</div>`;
}

function calculatorDetailsHtml(
  p: BlitzPayload,
  options: { includeRows: boolean; heading: string },
  locale: Locale = 'de',
): string {
  const handoff = p.kalkulator;
  if (!handoff) return '';

  const groups = groupCalculatorPicks(handoff.picks);
  const details = groups.map((group) => {
    const groupHasNested = group.items.length > 1 || group.items[0]?.label !== group.label;
    const items = group.items.map((item) => {
      const itemRows = options.includeRows && item.rows && item.rows.length > 0
        ? `<tr><td colspan="3" style="padding:0 0 10px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.rule};">
            <tr>
              <th align="left" style="padding:8px 10px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${escape(tt(locale, 'calcColPosition'))}</th>
              <th align="left" style="padding:8px 10px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};width:84px;">${escape(tt(locale, 'calcColQuantity'))}</th>
              <th align="right" style="padding:8px 10px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};width:90px;">${escape(tt(locale, 'calcColTotal'))}</th>
            </tr>
            ${item.rows.map((line) => `<tr>
              <td style="padding:8px 10px;border-top:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;line-height:1.4;color:${COLORS.ink};">${escape(cleanCalculatorLabel(line.label))}</td>
              <td style="padding:8px 10px;border-top:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;color:${COLORS.muted};white-space:nowrap;">${escape(formatQuantity(line.quantity, line.unit, locale))}</td>
              <td align="right" style="padding:8px 10px;border-top:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;color:${COLORS.ink};white-space:nowrap;">${escape(formatEuro(line.subtotal, locale))}</td>
            </tr>`).join('')}
          </table>
        </td></tr>`
        : '';

      if (!groupHasNested && !options.includeRows) return '';

      return `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:13px;line-height:1.4;color:${COLORS.ink};">${escape(cleanCalculatorLabel(item.label))}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;color:${COLORS.muted};">${item.rows?.length ? escape(interpolate(tt(locale, 'calcNPositions'), { n: item.rows.length })) : ''}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:13px;color:${COLORS.ink};white-space:nowrap;">${escape(formatEuro(item.subtotal, locale))}</td>
      </tr>${itemRows}`;
    }).join('');

    const simpleRows = !groupHasNested && options.includeRows && group.items[0]?.rows
      ? group.items[0].rows.map((line) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;line-height:1.4;color:${COLORS.ink};">${escape(cleanCalculatorLabel(line.label))}</td>
          <td style="padding:8px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;color:${COLORS.muted};white-space:nowrap;">${escape(formatQuantity(line.quantity, line.unit, locale))}</td>
          <td align="right" style="padding:8px 0;border-bottom:1px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:12px;color:${COLORS.ink};white-space:nowrap;">${escape(formatEuro(line.subtotal, locale))}</td>
        </tr>`).join('')
      : items;

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
  <tr>
    <td style="padding:12px 0;border-bottom:2px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:14px;font-weight:700;color:${COLORS.ink};">${escape(cleanCalculatorLabel(group.label))}</td>
    <td align="right" colspan="2" style="padding:12px 0;border-bottom:2px solid ${COLORS.rule};font-family:Helvetica, Arial, sans-serif;font-size:14px;font-weight:700;color:${COLORS.ink};white-space:nowrap;">${escape(formatEuro(group.subtotal, locale))}</td>
  </tr>
  ${simpleRows}
</table>`;
  }).join('');

  return `
${sectionTitle(options.heading)}
${calculatorSummaryHtml(p, handoff, locale)}
${details}`;
}

function calculatorDetailsText(
  p: BlitzPayload,
  options: { includeRows: boolean; heading: string },
  locale: Locale = 'de',
): string {
  const handoff = p.kalkulator;
  if (!handoff) return '';
  const artDisplay = locale === 'de' ? p.artLabel : artLabelFor(locale, p.art);
  const groups = groupCalculatorPicks(handoff.picks);
  const lines = [
    options.heading,
    `${tt(locale, 'rowObjectType')}: ${handoff.kindLabel || artDisplay}`,
    `${calculatorScopeLabel(p, locale)}: ${calculatorScopeValue(p, handoff, locale)}`,
    `${tt(locale, 'rowEstimate')}: ${formatEuro(handoff.totalMin, locale)} – ${formatEuro(handoff.totalMax, locale)}`,
    `${tt(locale, 'rowMid')}: ${formatEuro(handoff.totalMid, locale)}`,
    handoff.perM2 > 0 ? `${tt(locale, 'rowGuideValue')}: ${formatEuro(handoff.perM2, locale)} / m²` : '',
    '',
    tt(locale, 'calcChosenServices'),
  ].filter(Boolean);

  for (const group of groups) {
    lines.push(`- ${cleanCalculatorLabel(group.label)}: ${formatEuro(group.subtotal, locale)}`);
    const groupHasNested = group.items.length > 1 || group.items[0]?.label !== group.label;
    for (const item of group.items) {
      if (groupHasNested) lines.push(`  - ${cleanCalculatorLabel(item.label)}: ${formatEuro(item.subtotal, locale)}`);
      if (options.includeRows && item.rows) {
        for (const itemRow of item.rows) {
          lines.push(`    · ${cleanCalculatorLabel(itemRow.label)} (${formatQuantity(itemRow.quantity, itemRow.unit, locale)}): ${formatEuro(itemRow.subtotal, locale)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

function steps(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;border-top:1px solid ${COLORS.rule};">
${items
  .map(
    (item, i) => `<tr>
<td style="padding:14px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;width:32px;font-family:Helvetica, Arial, sans-serif;font-size:10px;font-weight:600;letter-spacing:0.24em;color:${COLORS.copper};">${String(i + 1).padStart(2, '0')}</td>
<td style="padding:14px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;font-family:Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;color:${COLORS.ink};">${escape(item)}</td>
</tr>`,
  )
  .join('')}
</table>`;
}

// ----- Office notification — Kontakt -----
// Intentionally kept in GERMAN regardless of the request locale: read by the
// German-speaking Prima Vista team. The submitted German display values
// (p.art / p.region / p.budget) are shown verbatim.

function kontaktTerminRows(p: KontaktPayload, locale: Locale = 'de'): string {
  if (!p.wunschtermin) return '';
  return [
    row(tt(locale, 'kontaktRowWunschtermin'), formatDateLong(p.wunschtermin, locale)),
    row(tt(locale, 'kontaktRowZeitfenster'), p.terminZeit ? formatTerminZeit(p.terminZeit, locale) : ''),
    row(tt(locale, 'kontaktRowTerminart'), p.terminArt ? terminArtLabel(locale, p.terminArt) : ''),
    row(
      tt(locale, 'kontaktRowAlternativ'),
      p.terminAlternativ ? formatTerminDateTime(p.terminAlternativ, p.terminAlternativZeit, locale) : '',
    ),
  ].join('');
}

function formatTerminZeit(time: string, locale: Locale): string {
  const range = `${time}–${consultationEndTime(time)}`;
  return locale === 'de' ? `${range} Uhr` : range;
}

function formatTerminDateTime(date: string, time: string | undefined, locale: Locale): string {
  const formattedDate = formatDateLong(date, locale);
  return time ? `${formattedDate} · ${formatTerminZeit(time, locale)}` : formattedDate;
}

function kontaktOfficeHtml(p: KontaktPayload): string {
  const rows = [
    row('Name', `${p.vorname} ${p.nachname}`),
    row('E-Mail', p.email),
    row('Telefon', p.tel || ''),
    row('Art', p.art || ''),
    row('Region', p.region || ''),
    row('Budget', p.budget || ''),
    kontaktTerminRows(p),
  ].join('');
  const terminCallout = p.wunschtermin
    ? callout(
      'Wunschtermin angefragt',
      `Der Termin ist noch nicht bestätigt — bitte innerhalb von 48 Stunden bestätigen oder Alternativen anbieten. Der genaue Zeitraum ist vorläufig im verbundenen Kalender reserviert.`,
    )
    : '';
  const body = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
<h2 style="margin:32px 0 12px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">Nachricht</h2>
${bodyParagraph(p.msg)}
${terminCallout}
<p style="margin:24px 0 0 0;padding:14px 16px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:12px;line-height:1.5;color:${COLORS.muted};border-left:2px solid ${COLORS.copper};">
Antworten Sie direkt auf diese E-Mail, um mit ${escape(p.vorname)} in Kontakt zu treten.
</p>`;
  return shell(`Neue Anfrage von ${escape(p.vorname)} ${escape(p.nachname)}`, 'Kontaktformular · Neue Anfrage', body);
}

function kontaktOfficeText(p: KontaktPayload): string {
  return [
    `Neue Anfrage über das Kontaktformular`,
    ``,
    `Name: ${p.vorname} ${p.nachname}`,
    `E-Mail: ${p.email}`,
    p.tel ? `Telefon: ${p.tel}` : '',
    p.art ? `Art: ${p.art}` : '',
    p.region ? `Region: ${p.region}` : '',
    p.budget ? `Budget: ${p.budget}` : '',
    p.wunschtermin ? `Wunschtermin: ${formatDateLong(p.wunschtermin, 'de')}` : '',
    p.wunschtermin && p.terminZeit ? `Uhrzeit: ${formatTerminZeit(p.terminZeit, 'de')}` : '',
    p.wunschtermin && p.terminArt ? `Terminart: ${terminArtLabel('de', p.terminArt)}` : '',
    p.wunschtermin && p.terminAlternativ
      ? `Alternativtermin: ${formatTerminDateTime(p.terminAlternativ, p.terminAlternativZeit, 'de')}`
      : '',
    ``,
    `Nachricht:`,
    p.msg,
    p.wunschtermin
      ? `\nWunschtermin angefragt: noch nicht bestätigt — bitte innerhalb von 48 Stunden bestätigen oder Alternativen anbieten.`
      : '',
    ``,
    `— Antworten Sie direkt auf diese E-Mail, um mit ${p.vorname} in Kontakt zu treten.`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ----- Customer confirmation — Kontakt (localized by request locale) -----

// The kontakt `art` value POSTed is a canonical code (e.g. 'haus'). For `de`
// the code is echoed verbatim, preserving the existing byte-for-byte output;
// for en/it it is mapped to a localized label via the server code→label map.
function kontaktArtDisplay(p: KontaktPayload, locale: Locale): string {
  if (!p.art) return '';
  return locale === 'de' ? p.art : kontaktArtLabel(locale, p.art);
}

function kontaktPhoneSuffix(p: KontaktPayload, locale: Locale): string {
  return p.tel ? interpolate(tt(locale, 'kontaktPhoneSuffix'), { tel: p.tel }) : '';
}

function kontaktConfirmHtml(p: KontaktPayload, locale: Locale): string {
  const echo = [
    row(tt(locale, 'kontaktRowEmail'), p.email),
    row(tt(locale, 'kontaktRowTel'), p.tel || ''),
    row(tt(locale, 'kontaktRowArt'), kontaktArtDisplay(p, locale)),
    kontaktTerminRows(p, locale),
  ].join('');
  const terminNote = p.wunschtermin
    ? `<p style="margin:16px 0 0 0;padding:14px 16px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:12px;line-height:1.55;color:${COLORS.muted};border-left:2px solid ${COLORS.copper};">${nl2br(tt(locale, 'kontaktTerminNote'))}</p>`
    : '';
  const body = `
${bodyParagraph(
  interpolate(tt(locale, 'kontaktIntro'), { email: p.email, phone: kontaktPhoneSuffix(p, locale) }),
)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;">${echo}</table>
${terminNote}
<h2 style="margin:32px 0 8px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(tt(locale, 'nextSteps'))}</h2>
${steps([
  tt(locale, 'kontaktStep1'),
  tt(locale, 'kontaktStep2'),
  tt(locale, 'kontaktStep3'),
])}
${bodyParagraph(tt(locale, 'signature'))}`;
  return shell(interpolate(tt(locale, 'kontaktTitle'), { name: escape(p.vorname) }), tt(locale, 'kontaktEyebrow'), body, locale);
}

function kontaktConfirmText(p: KontaktPayload, locale: Locale): string {
  return [
    interpolate(tt(locale, 'kontaktTitle'), { name: p.vorname }),
    ``,
    interpolate(tt(locale, 'kontaktIntroText'), { email: p.email, phone: kontaktPhoneSuffix(p, locale) }),
    p.wunschtermin ? `\n${tt(locale, 'kontaktRowWunschtermin')}: ${formatDateLong(p.wunschtermin, locale)}` : '',
    p.wunschtermin && p.terminZeit ? `${tt(locale, 'kontaktRowZeitfenster')}: ${formatTerminZeit(p.terminZeit, locale)}` : '',
    p.wunschtermin && p.terminArt ? `${tt(locale, 'kontaktRowTerminart')}: ${terminArtLabel(locale, p.terminArt)}` : '',
    p.wunschtermin && p.terminAlternativ
      ? `${tt(locale, 'kontaktRowAlternativ')}: ${formatTerminDateTime(p.terminAlternativ, p.terminAlternativZeit, locale)}`
      : '',
    p.wunschtermin ? `${tt(locale, 'kontaktTerminNote')}` : '',
    ``,
    `${tt(locale, 'nextSteps')}:`,
    `01  ${tt(locale, 'kontaktStep1')}`,
    `02  ${tt(locale, 'kontaktStep2')}`,
    `03  ${tt(locale, 'kontaktStep3')}`,
    ``,
    tt(locale, 'signatureLine1'),
    tt(locale, 'signatureName'),
    tt(locale, 'company'),
    businessPhoneText(locale),
  ].join('\n');
}

// ----- Office notification — Blitz -----

// Office notification — intentionally kept in GERMAN regardless of the request
// locale: it is read by the German-speaking Prima Vista team, so the shared
// helpers are called with the default 'de'.
function blitzOfficeHtml(p: BlitzPayload, autoEstimate?: BlitzEstimate): string {
  const rows = [
    row('Name', p.name),
    row('E-Mail', p.email),
    row('Telefon', p.tel || ''),
    blitzProjectRows(p),
  ].join('');
  const calculatorBlock = calculatorDetailsHtml(p, {
    includeRows: true,
    heading: 'Übernommene Kalkulation',
  });
  const legacyCalculatorBlock = legacyCalculatorBlockHtml(p, 'Übernommene Kalkulation');
  const msgBlock = p.msg && !isLegacyCalculatorNote(p.msg)
    ? `${sectionTitle('Besonderheiten / Kundennotiz')}${bodyParagraph(p.msg)}`
    : '';
  const body = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
${blitzServiceSectionHtml('Gewählte Leistungen / Anfragebereich', p, 'de', 28)}
${calculatorBlock}
${legacyCalculatorBlock}
${msgBlock}
${autoEstimate ? blitzAutoOfficeCallout(p, autoEstimate) : callout(
  'Nächster Schritt',
  `Innerhalb von 24 Stunden mit einer ersten Kostenschätzung antworten. Eine Antwort auf diese E-Mail geht direkt an ${p.email}.`,
)}`;
  return shell(
    `Blitzanfrage von ${escape(p.name)}`,
    autoEstimate ? 'Blitzangebot · Automatisch beantwortet' : 'Blitzangebot · Kostenschätzung in 24 Std.',
    body,
  );
}

function blitzOfficeText(p: BlitzPayload, autoEstimate?: BlitzEstimate): string {
  return [
    autoEstimate ? `Neue Blitzanfrage — automatisch beantwortet` : `Neue Blitzanfrage`,
    ``,
    `Name: ${p.name}`,
    `E-Mail: ${p.email}`,
    p.tel ? `Telefon: ${p.tel}` : '',
    hasCalculatorContext(p) ? `Anfrage: Aus dem Kalkulator übernommen` : `Objektart: ${p.artLabel}`,
    hasCalculatorContext(p) ? `Rechner: ${p.kalkulator?.kindLabel || legacyCalculatorField(p.msg, 'Objektart') || p.artLabel}` : `${blitzScopeLabel(p)}: ${blitzScopeValue(p)}`,
    p.kalkulator
      ? `${calculatorScopeLabel(p)}: ${calculatorScopeValue(p, p.kalkulator)}`
      : isLegacyCalculatorNote(p.msg) && legacyCalculatorScope(p.msg)
        ? `${legacyCalculatorScope(p.msg)!.label}: ${legacyCalculatorScope(p.msg)!.value}`
        : '',
    p.kalkulator
      ? `Kostenschätzung: ${formatEuro(p.kalkulator.totalMin)} – ${formatEuro(p.kalkulator.totalMax)}`
      : isLegacyCalculatorNote(p.msg) && legacyCalculatorEstimate(p.msg)
        ? `Kostenschätzung: ${legacyCalculatorEstimate(p.msg)}`
        : '',
    `Baubeginn: ${p.starterminLabel}`,
    blitzServiceSectionText('Gewählte Leistungen / Anfragebereich', p),
    p.kalkulator ? `\n${calculatorDetailsText(p, { includeRows: true, heading: 'Übernommene Kalkulation' })}` : '',
    !p.kalkulator && isLegacyCalculatorNote(p.msg) ? `\nÜbernommene Kalkulation:\n${cleanLegacyCalculatorNote(p.msg)}` : '',
    p.msg && !isLegacyCalculatorNote(p.msg) ? `\nBesonderheiten / Kundennotiz:\n${p.msg}` : '',
    ``,
    autoEstimate
      ? `Automatische Kostenschätzung versendet: ${formatEuro(autoEstimate.totalMin)} – ${formatEuro(autoEstimate.totalMax)} (Mittelwert ${formatEuro(autoEstimate.totalMid)}). Kein manueller Versand nötig.`
      : `Nächster Schritt: Innerhalb von 24 Stunden mit einer ersten Kostenschätzung antworten.`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ----- Customer confirmation — Blitz (localized by request locale) -----

function blitzPhoneSuffix(p: BlitzPayload, locale: Locale): string {
  return p.tel ? interpolate(tt(locale, 'kontaktPhoneSuffix'), { tel: p.tel }) : '';
}

function blitzConfirmHtml(p: BlitzPayload, locale: Locale): string {
  const firstName = p.name.trim().split(/\s+/)[0] ?? p.name;
  const echo = blitzProjectRows(p, locale);
  const calculatorBlock = calculatorDetailsHtml(p, {
    includeRows: false,
    heading: tt(locale, 'blitzCalcHeading'),
  }, locale);
  const legacyCalculatorBlock = legacyCalculatorBlockHtml(p, tt(locale, 'blitzCalcHeading'));
  const noteBlock = p.msg && !isLegacyCalculatorNote(p.msg)
    ? `${sectionTitle(tt(locale, 'blitzYourNote'))}${bodyParagraph(p.msg)}`
    : '';
  const body = `
${bodyParagraph(
  interpolate(tt(locale, 'blitzIntro'), { email: p.email, phone: blitzPhoneSuffix(p, locale) }),
)}
<h2 style="margin:24px 0 8px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(tt(locale, 'blitzYourDetails'))}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${echo}</table>
${blitzServiceSectionHtml(tt(locale, 'blitzYourServices'), p, locale, 28)}
${calculatorBlock}
${legacyCalculatorBlock}
${noteBlock}
<h2 style="margin:32px 0 8px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(tt(locale, 'nextSteps'))}</h2>
${steps([
  tt(locale, 'blitzStep1'),
  tt(locale, 'blitzStep2'),
  tt(locale, 'blitzStep3'),
])}
${bodyParagraph(tt(locale, 'signature'))}`;
  return shell(interpolate(tt(locale, 'blitzTitle'), { name: escape(firstName) }), tt(locale, 'blitzEyebrow'), body, locale);
}

function blitzConfirmText(p: BlitzPayload, locale: Locale): string {
  const firstName = p.name.trim().split(/\s+/)[0] ?? p.name;
  const isDe = locale === 'de';
  const artDisplay = isDe ? p.artLabel : artLabelFor(locale, p.art);
  const starttermin = isDe ? p.starterminLabel : starterminLabelFor(locale, p.starttermin);
  return [
    interpolate(tt(locale, 'blitzTitle'), { name: firstName }),
    ``,
    interpolate(tt(locale, 'blitzIntroText'), { email: p.email, phone: blitzPhoneSuffix(p, locale) }),
    ``,
    `${tt(locale, 'blitzYourDetails')}:`,
    hasCalculatorContext(p) ? `· ${tt(locale, 'rowRequest')}: ${tt(locale, 'rowRequestValue')}` : `· ${tt(locale, 'rowObjectType')}: ${artDisplay}`,
    hasCalculatorContext(p) ? `· ${tt(locale, 'rowCalculator')}: ${p.kalkulator?.kindLabel || legacyCalculatorField(p.msg, 'Objektart') || artDisplay}` : `· ${blitzScopeLabel(p, locale)}: ${blitzScopeValue(p)}`,
    p.kalkulator
      ? `· ${calculatorScopeLabel(p, locale)}: ${calculatorScopeValue(p, p.kalkulator, locale)}`
      : isLegacyCalculatorNote(p.msg) && legacyCalculatorScope(p.msg)
        ? `· ${legacyCalculatorScope(p.msg)!.label}: ${legacyCalculatorScope(p.msg)!.value}`
        : '',
    p.kalkulator
      ? `· ${tt(locale, 'rowEstimate')}: ${formatEuro(p.kalkulator.totalMin, locale)} – ${formatEuro(p.kalkulator.totalMax, locale)}`
      : isLegacyCalculatorNote(p.msg) && legacyCalculatorEstimate(p.msg)
        ? `· ${tt(locale, 'rowEstimate')}: ${legacyCalculatorEstimate(p.msg)}`
        : '',
    `· ${tt(locale, 'rowStart')}: ${starttermin}`,
    blitzServiceSectionText(tt(locale, 'blitzYourServices'), p, locale),
    p.kalkulator ? `\n${calculatorDetailsText(p, { includeRows: false, heading: tt(locale, 'blitzCalcHeading') }, locale)}` : '',
    !p.kalkulator && isLegacyCalculatorNote(p.msg) ? `\n${tt(locale, 'blitzCalcHeading')}:\n${cleanLegacyCalculatorNote(p.msg)}` : '',
    p.msg && !isLegacyCalculatorNote(p.msg) ? `\n${tt(locale, 'blitzYourNote')}:\n${p.msg}` : '',
    ``,
    `${tt(locale, 'nextSteps')}:`,
    `01  ${tt(locale, 'blitzStep1')}`,
    `02  ${tt(locale, 'blitzStep2')}`,
    `03  ${tt(locale, 'blitzStep3Text')}`,
    ``,
    tt(locale, 'signatureLine1'),
    tt(locale, 'signatureName'),
    tt(locale, 'company'),
    businessPhoneText(locale),
  ].join('\n');
}

// ----- Customer automatic estimate — Blitz (localized by request locale) -----

function estimateBlockHtml(estimate: BlitzEstimate, locale: Locale): string {
  const midLine = [
    `${tt(locale, 'rowMid')}: ${formatEuro(estimate.totalMid, locale)}`,
    estimate.perM2 > 0 ? `${tt(locale, 'rowGuideValue')}: ${formatEuro(estimate.perM2, locale)} / m²` : '',
  ].filter(Boolean).join(' · ');
  return `
<div style="margin:24px 0;padding:22px 24px;background:${COLORS.bg};border-left:3px solid ${COLORS.red};">
  <div style="font-family:Helvetica, Arial, sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.copper};margin-bottom:10px;">${escape(tt(locale, 'blitzAutoRangeLabel'))}</div>
  <div style="font-family:Georgia, 'Times New Roman', serif;font-style:italic;font-weight:500;font-size:28px;line-height:1.2;color:${COLORS.ink};">${escape(`${formatEuro(estimate.totalMin, locale)} – ${formatEuro(estimate.totalMax, locale)}`)}</div>
  <div style="margin-top:8px;font-family:Helvetica, Arial, sans-serif;font-size:13px;line-height:1.5;color:${COLORS.muted};">${escape(midLine)}</div>
  <div style="margin-top:6px;font-family:Helvetica, Arial, sans-serif;font-size:11px;line-height:1.5;color:${COLORS.muted};">${escape(tt(locale, 'blitzAutoRangeNote'))}</div>
</div>`;
}

function blitzAutoHtml(p: BlitzPayload, estimate: BlitzEstimate, pdfAttached: boolean, locale: Locale): string {
  const firstName = p.name.trim().split(/\s+/)[0] ?? p.name;
  const body = `
${bodyParagraph(tt(locale, 'blitzAutoIntro'))}
${estimateBlockHtml(estimate, locale)}
<h2 style="margin:24px 0 8px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(tt(locale, 'blitzYourDetails'))}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${blitzProjectRows(p, locale)}</table>
${blitzServiceSectionHtml(tt(locale, 'blitzYourServices'), p, locale, 28)}
${pdfAttached ? bodyParagraph(tt(locale, 'blitzAutoPdfNote')) : ''}
${sectionTitle(tt(locale, 'blitzAutoAssumptions'))}
${bodyParagraph(tt(locale, 'blitzAutoAssumption1'))}
${bodyParagraph(tt(locale, 'blitzAutoAssumption2'))}
${bodyParagraph(tt(locale, 'blitzAutoAssumption3'))}
<p style="margin:16px 0 0 0;padding:14px 16px;background:${COLORS.bg};font-family:Helvetica, Arial, sans-serif;font-size:12px;line-height:1.55;color:${COLORS.muted};border-left:2px solid ${COLORS.copper};">${nl2br(tt(locale, 'blitzAutoDisclaimer'))}</p>
<h2 style="margin:32px 0 8px 0;font-family:Helvetica, Arial, sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.copper};">${escape(tt(locale, 'nextSteps'))}</h2>
${steps([
  tt(locale, 'blitzAutoStep1'),
  tt(locale, 'blitzAutoStep2'),
  tt(locale, 'blitzAutoStep3'),
])}
${bodyParagraph(tt(locale, 'signature'))}`;
  return shell(interpolate(tt(locale, 'blitzAutoTitle'), { name: escape(firstName) }), tt(locale, 'blitzAutoEyebrow'), body, locale);
}

function blitzAutoText(p: BlitzPayload, estimate: BlitzEstimate, pdfAttached: boolean, locale: Locale): string {
  const firstName = p.name.trim().split(/\s+/)[0] ?? p.name;
  const isDe = locale === 'de';
  const artDisplay = isDe ? p.artLabel : artLabelFor(locale, p.art);
  const starttermin = isDe ? p.starterminLabel : starterminLabelFor(locale, p.starttermin);
  return [
    interpolate(tt(locale, 'blitzAutoTitle'), { name: firstName }),
    ``,
    tt(locale, 'blitzAutoIntro'),
    ``,
    `${tt(locale, 'blitzAutoRangeLabel')}: ${formatEuro(estimate.totalMin, locale)} – ${formatEuro(estimate.totalMax, locale)}`,
    `${tt(locale, 'rowMid')}: ${formatEuro(estimate.totalMid, locale)}`,
    estimate.perM2 > 0 ? `${tt(locale, 'rowGuideValue')}: ${formatEuro(estimate.perM2, locale)} / m²` : '',
    tt(locale, 'blitzAutoRangeNote'),
    ``,
    `${tt(locale, 'blitzYourDetails')}:`,
    `· ${tt(locale, 'rowObjectType')}: ${p.kalkulator?.kindLabel || artDisplay}`,
    `· ${blitzScopeLabel(p, locale)}: ${p.kalkulator ? calculatorScopeValue(p, p.kalkulator, locale) : blitzScopeValue(p)}`,
    `· ${tt(locale, 'rowStart')}: ${starttermin}`,
    blitzServiceSectionText(tt(locale, 'blitzYourServices'), p, locale),
    pdfAttached ? `\n${tt(locale, 'blitzAutoPdfNote')}` : '',
    ``,
    `${tt(locale, 'blitzAutoAssumptions')}:`,
    `· ${tt(locale, 'blitzAutoAssumption1')}`,
    `· ${tt(locale, 'blitzAutoAssumption2')}`,
    `· ${tt(locale, 'blitzAutoAssumption3')}`,
    ``,
    tt(locale, 'blitzAutoDisclaimer'),
    ``,
    `${tt(locale, 'nextSteps')}:`,
    `01  ${tt(locale, 'blitzAutoStep1')}`,
    `02  ${tt(locale, 'blitzAutoStep2')}`,
    `03  ${tt(locale, 'blitzAutoStep3')}`,
    ``,
    tt(locale, 'signatureLine1'),
    tt(locale, 'signatureName'),
    tt(locale, 'company'),
    businessPhoneText(locale),
  ].filter((line) => line !== '').join('\n');
}

// Office notification for an automatically answered request — German, mirrors
// blitzOfficeHtml but swaps the 24-hour action callout for the sent estimate.
function blitzAutoOfficeCallout(p: BlitzPayload, estimate: BlitzEstimate): string {
  const basis = estimate.basis === 'kalkulator'
    ? 'Kalkulator-Übernahme (Summen serverseitig neu berechnet)'
    : 'Blitzauswahl · Standardkonfiguration des Online-Kalkulators';
  const detailLines = estimate.details?.length
    ? `\n${estimate.details.map((d) => `${d.label}: ${formatEuro(d.net)}`).join('\n')}`
    : '';
  return callout(
    'Automatische Kostenschätzung versendet',
    `Der Kunde hat automatisch eine vorläufige Kostenschätzung erhalten: `
    + `${formatEuro(estimate.totalMin)} – ${formatEuro(estimate.totalMax)} `
    + `(Mittelwert ${formatEuro(estimate.totalMid)}${estimate.perM2 > 0 ? `, ca. ${formatEuro(estimate.perM2)} / m²` : ''}). `
    + `Basis: ${basis}. Kein manueller Versand nötig — eine Antwort auf diese E-Mail geht direkt an ${p.email}.${detailLines}`,
  );
}

// ----- Calculator-PDF covering email (localized by request locale) -----

function calculatorPdfHtml(p: CalculatorPdfPayload, locale: Locale): string {
  const body = `
${bodyParagraph(
  interpolate(tt(locale, 'pdfMailIntro'), { kind: p.kalkulator.kindLabel }),
)}
${steps([
  tt(locale, 'pdfMailStep1'),
  tt(locale, 'pdfMailStep2'),
  tt(locale, 'pdfMailStep3'),
])}
${bodyParagraph(tt(locale, 'signature'))}`;

  return shell(tt(locale, 'pdfMailTitle'), tt(locale, 'pdfMailEyebrow'), body, locale);
}

function calculatorPdfText(p: CalculatorPdfPayload, locale: Locale): string {
  return [
    tt(locale, 'pdfMailTitle'),
    ``,
    interpolate(tt(locale, 'pdfMailIntroText1'), { kind: p.kalkulator.kindLabel }),
    tt(locale, 'pdfMailIntroText2'),
    ``,
    `${tt(locale, 'nextSteps')}:`,
    `01  ${tt(locale, 'pdfMailStep1')}`,
    `02  ${tt(locale, 'pdfMailStep2')}`,
    `03  ${tt(locale, 'pdfMailStep3')}`,
    ``,
    tt(locale, 'signatureLine1'),
    tt(locale, 'signatureName'),
    tt(locale, 'company'),
    businessPhoneText(locale),
  ].join('\n');
}

// ----- Public API -----

type RenderedEmail = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export function renderBlitzEmails(payload: BlitzPayload): {
  office: RenderedEmail;
  customer: RenderedEmail;
} {
  const locale = normalizeLocale(payload.locale);
  return {
    // Office: always German (subject + body) — read by the Prima Vista team.
    office: {
      from: FROM,
      to: TO_OFFICE,
      replyTo: payload.email,
      subject: `Blitzanfrage · ${payload.name} · ${blitzRequestContext(payload)}`,
      html: blitzOfficeHtml(payload),
      text: blitzOfficeText(payload),
    },
    // Customer confirmation: localized to the request locale.
    customer: {
      from: FROM,
      to: payload.email,
      replyTo: TO_OFFICE,
      subject: tt(locale, 'blitzSubject'),
      html: blitzConfirmHtml(payload, locale),
      text: blitzConfirmText(payload, locale),
    },
  };
}

export async function sendKontaktEmails(payload: KontaktPayload): Promise<void> {
  const locale = normalizeLocale(payload.locale);
  // Office notification — German, reply-to set to customer so the team can reply directly.
  await sendEmail({
    from: FROM,
    to: TO_OFFICE,
    replyTo: payload.email,
    subject: `Neue Anfrage · ${payload.vorname} ${payload.nachname}`,
    html: kontaktOfficeHtml(payload),
    text: kontaktOfficeText(payload),
  }, 'Kontakt office');
  // Customer confirmation — localized; reply-to set to office so the customer can write back.
  await sendEmail({
    from: FROM,
    to: payload.email,
    replyTo: TO_OFFICE,
    subject: tt(locale, 'kontaktSubject'),
    html: kontaktConfirmHtml(payload, locale),
    text: kontaktConfirmText(payload, locale),
  }, 'Kontakt confirmation');
}

export async function sendBlitzEmails(payload: BlitzPayload): Promise<void> {
  const rendered = renderBlitzEmails(payload);
  await sendEmail({
    from: rendered.office.from,
    to: rendered.office.to,
    replyTo: rendered.office.replyTo,
    subject: rendered.office.subject,
    html: rendered.office.html,
    text: rendered.office.text,
  }, 'Blitz office');
  await sendEmail({
    from: rendered.customer.from,
    to: rendered.customer.to,
    replyTo: rendered.customer.replyTo,
    subject: rendered.customer.subject,
    html: rendered.customer.html,
    text: rendered.customer.text,
  }, 'Blitz confirmation');
}

/** Automatic Blitz estimate: office notification (German, action-free) plus
 *  the localized customer estimate. Any trusted, non-empty calculator handoff
 *  is rendered as the detailed PDF breakdown and attached for the customer. */
export async function sendBlitzAutoEmails(payload: BlitzPayload, estimate: BlitzEstimate): Promise<void> {
  const locale = normalizeLocale(payload.locale);
  const pdfAttached = Boolean(payload.kalkulator?.picks?.length);

  let attachments: Array<{ filename: string; content: Buffer }> | undefined;
  if (pdfAttached && payload.kalkulator) {
    const pdf = await buildCalculatorPdf({
      email: payload.email,
      consent: true,
      kalkulator: payload.kalkulator,
      locale,
    }, {
      // Direct package defaults already include every priced line in the main
      // table. Skip the repetitive product-card appendix to keep email size and
      // generation time sensible; calculator-origin PDFs retain the appendix.
      includeProductDetails: estimate.basis !== 'pakete',
    });
    attachments = [{ filename: 'prima-vista-vorab-schaetzung.pdf', content: pdf }];
  }

  await sendEmail({
    from: FROM,
    to: TO_OFFICE,
    replyTo: payload.email,
    subject: `Blitzanfrage · ${payload.name} · ${blitzRequestContext(payload)} · automatisch beantwortet`,
    html: blitzOfficeHtml(payload, estimate),
    text: blitzOfficeText(payload, estimate),
  }, 'Blitz office (auto)');

  await sendEmail({
    from: FROM,
    to: payload.email,
    replyTo: TO_OFFICE,
    subject: tt(locale, 'blitzAutoSubject'),
    html: blitzAutoHtml(payload, estimate, pdfAttached, locale),
    text: blitzAutoText(payload, estimate, pdfAttached, locale),
    ...(attachments ? { attachments } : {}),
  }, 'Blitz estimate');
}

export async function sendCalculatorPdfEmail(payload: CalculatorPdfPayload): Promise<void> {
  const locale = normalizeLocale(payload.locale);
  const pdf = await buildCalculatorPdf(payload);
  const slug = cleanCalculatorLabel(payload.kalkulator.kindLabel)
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'kalkulator';

  await sendEmail({
    from: FROM,
    to: payload.email,
    bcc: TO_OFFICE,
    replyTo: TO_OFFICE,
    subject: interpolate(tt(locale, 'pdfMailSubject'), { kind: payload.kalkulator.kindLabel }),
    html: calculatorPdfHtml(payload, locale),
    text: calculatorPdfText(payload, locale),
    attachments: [{
      filename: `prima-vista-${slug}.pdf`,
      content: pdf,
    }],
  }, 'Calculator PDF');
}

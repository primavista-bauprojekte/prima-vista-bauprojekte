import PDFDocument from 'pdfkit';
import { businessContact } from '../shared/contact.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { KalkulatorHandoff, KalkulatorPick, KalkulatorRow } from './mail.js';
import {
  type Locale,
  type StringKey,
  formatEuroPdf,
  formatQuantity as formatQuantityFor,
  interpolate,
  normalizeLocale,
  tt,
} from './i18n.js';

export type CalculatorPdfPayload = {
  email: string;
  consent: boolean;
  kalkulator: KalkulatorHandoff;
  sourceUrl?: string;
  /** Request locale — localizes the customer-facing PDF. Defaults 'de'. */
  locale?: Locale;
};

export type CalculatorPdfOptions = {
  /** Keep the detailed product-card appendix by default. Automatic estimates
   *  can disable it when the itemized calculation table is sufficient. */
  includeProductDetails?: boolean;
};

type PdfGroup = {
  key: string;
  label: string;
  subtotal: number;
  items: KalkulatorPick[];
};

type ProductDetail = {
  id: string;
  label: string;
  sku?: string;
  description?: string;
  image?: string;
  category: string;
  subcategory?: string;
  type?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  subtotal: number;
};

const PAGE = {
  marginX: 46,
  top: 48,
  bottom: 112,
  width: 595.28,
  height: 841.89,
};

const COLORS = {
  ink: '#171412',
  muted: '#6f6862',
  faint: '#aaa19a',
  copper: '#c28d59',
  red: '#b61d1a',
  link: '#1537e8',
  bone: '#f6f0ea',
  rule: '#ded5cd',
  paper: '#fbf8f5',
};

const DEFAULT_SOURCE_URL = 'https://primavista-bauprojekte.com';

const ADDRESS_FIELD_KEYS: StringKey[] = [
  'pdfAddrFirma',
  'pdfAddrName',
  'pdfAddrStreet',
  'pdfAddrZipCity',
  'pdfAddrState',
  'pdfAddrCountry',
  'pdfAddrTaxId',
];

const GENERIC_PRODUCT_DESCRIPTION = 'Kalkulationsposition fuer Montage, Material oder Zusatzleistung.';

let cachedLogo: Buffer | null | undefined;

function getLogoBuffer(): Buffer | null {
  if (cachedLogo !== undefined) return cachedLogo;
  const candidates = [
    path.join(process.cwd(), 'public', 'assets', 'img', 'logo.png'),
    path.join(process.cwd(), 'assets', 'img', 'logo.png'),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  cachedLogo = logoPath ? readFileSync(logoPath) : null;
  return cachedLogo;
}

function cleanLabel(value: string): string {
  return String(value || '')
    .replace(/[🛠🔧]/gu, '')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\|/g, ' |')
    .replace(/\|\s+/g, '| ')
    .trim();
}

function localeTag(locale: Locale): string {
  return locale === 'en' ? 'en-US' : locale === 'it' ? 'it-IT' : 'de-DE';
}

function formatEuro(value: number, locale: Locale, cents = true): string {
  return formatEuroPdf(value, locale, cents);
}

function formatQuantity(quantity: number, unit: string, locale: Locale): string {
  // The PDF uses a '-' fallback (not the '—' used in mail.ts).
  return formatQuantityFor(quantity, unit, locale, '-');
}

function formatScope(handoff: KalkulatorHandoff, locale: Locale): string {
  // Unit detection keys on the GERMAN scope label; the amount is locale-formatted.
  const label = (handoff.scopeLabel || '').toLocaleLowerCase('de-DE');
  const amount = Number.isFinite(handoff.area) ? handoff.area.toLocaleString(localeTag(locale)) : '-';
  if (/laufmeter|zaunlänge/.test(label)) return `${amount} m`;
  if (/qm|m²|fläche|wohnfläche|dachfläche|fassadenfläche/.test(label)) return `${amount} m²`;
  return amount;
}

function groupCalculatorPicks(picks: KalkulatorPick[]): PdfGroup[] {
  const groups: PdfGroup[] = [];
  const byKey = new Map<string, PdfGroup>();
  let lastGroup: PdfGroup | null = null;

  function push(group: PdfGroup, pick: KalkulatorPick) {
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
      const group: PdfGroup = {
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

function collectLineItems(handoff: KalkulatorHandoff): Array<{ group: PdfGroup; line: KalkulatorRow | KalkulatorPick; nested: boolean }> {
  const result: Array<{ group: PdfGroup; line: KalkulatorRow | KalkulatorPick; nested: boolean }> = [];
  for (const group of groupCalculatorPicks(handoff.picks)) {
    for (const item of group.items) {
      if (item.rows && item.rows.length > 0) {
        for (const row of item.rows) result.push({ group, line: row, nested: true });
      } else {
        result.push({ group, line: item, nested: false });
      }
    }
  }
  return result;
}

function collectProductDetails(handoff: KalkulatorHandoff): ProductDetail[] {
  const details: ProductDetail[] = [];
  const seen = new Set<string>();

  for (const group of groupCalculatorPicks(handoff.picks)) {
    for (const item of group.items) {
      const category = cleanLabel(item.category || item.tradeLabel || group.label);
      if (item.rows && item.rows.length > 0) {
        item.rows.forEach((row, index) => {
          const label = cleanLabel(row.label);
          const id = `${row.sku || item.key || group.key}:${label}:${index}`;
          if (seen.has(id)) return;
          seen.add(id);
          details.push({
            id,
            label,
            sku: row.sku,
            description: row.description,
            image: row.image,
            category: cleanLabel(row.category || category),
            subcategory: row.subcategory ? cleanLabel(row.subcategory) : undefined,
            type: row.type,
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unitPrice,
            subtotal: row.subtotal,
          });
        });
      } else {
        const label = cleanLabel(item.label);
        const id = `${item.sku || item.key || group.key}:${label}`;
        if (seen.has(id)) continue;
        seen.add(id);
        details.push({
          id,
          label,
          sku: item.sku,
          description: item.description,
          image: item.image,
          category,
          subcategory: item.subcategory ? cleanLabel(item.subcategory) : undefined,
          type: item.type,
          subtotal: item.subtotal,
        });
      }
    }
  }

  return details;
}

function lineQuantity(line: KalkulatorRow | KalkulatorPick, handoff: KalkulatorHandoff, locale: Locale): string {
  if ('quantity' in line) return formatQuantity(line.quantity, line.unit, locale);
  return handoff.area > 0 ? formatQuantity(handoff.area, 'm²', locale) : `1 ${tt(locale, 'unitFallback')}`;
}

function lineUnitPrice(line: KalkulatorRow | KalkulatorPick, handoff: KalkulatorHandoff): number {
  if ('unitPrice' in line) return line.unitPrice;
  if (handoff.area > 0) return line.subtotal / handoff.area;
  return line.subtotal;
}

function compactDescription(detail: ProductDetail, locale: Locale): string {
  const raw = cleanLabel(detail.description || '');
  // `detail.description` is product copy authored in German in the catalog; when
  // it is present and meaningful it is shown as-is (no per-product translation
  // exists). The generic FALLBACK sentence is localized.
  const usable = raw && raw !== GENERIC_PRODUCT_DESCRIPTION && raw.length > 18;
  const text = usable
    ? raw
    : interpolate(tt(locale, 'pdfProductGenericDescription'), { label: detail.label, category: detail.category });
  return text.length > 520 ? `${text.slice(0, 517).trim()}...` : text;
}

function readableSkuPrefix(detail: ProductDetail): string {
  const fromSku = detail.sku?.split(/[-_\s]/)[0];
  const source = fromSku || detail.type || 'PV';
  return cleanLabel(source).slice(0, 5).toLocaleUpperCase('de-DE') || 'PV';
}

function addHeader(doc: PDFKit.PDFDocument, title: string, locale: Locale) {
  const logo = getLogoBuffer();
  const logoSize = 48;
  const wordmarkX = logo ? PAGE.marginX + logoSize + 16 : PAGE.marginX;

  doc.save();
  doc.rect(0, 0, PAGE.width, 92).fill(COLORS.ink);
  if (logo) {
    doc
      .roundedRect(PAGE.marginX, 20, logoSize, logoSize, 6)
      .fillOpacity(0.08)
      .fill(COLORS.bone)
      .fillOpacity(1)
      .strokeColor(COLORS.bone)
      .strokeOpacity(0.18)
      .lineWidth(0.6)
      .stroke()
      .strokeOpacity(1);
    doc.image(logo, PAGE.marginX + 5, 25, { fit: [38, 38], align: 'center', valign: 'center' });
  }
  doc
    .fillColor(COLORS.bone)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('PRIMA VISTA', wordmarkX, 30, { continued: true })
    .fillColor(COLORS.copper)
    .text(' BAUPROJEKTE');
  doc
    .fillColor(COLORS.faint)
    .font('Helvetica')
    .fontSize(8)
    .text(tt(locale, 'pdfHeaderTagline'), wordmarkX, 58, { characterSpacing: 1.5 });
  doc.restore();

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(title, PAGE.marginX, 126, { align: 'center', width: PAGE.width - (PAGE.marginX * 2) });
  doc.y = 176;
}

function addFooter(doc: PDFKit.PDFDocument, pageNumber: number, totalPages: number, locale: Locale) {
  const y = PAGE.height - 100;
  // `isOffice` (not the localized title) drives the copper-accent styling so it
  // survives translation. Address/contact/legal lines are factual data; only
  // the section TITLES (and the translatable phone/email/tax labels) localize.
  const columns = [
    {
      x: PAGE.marginX,
      width: 128,
      isOffice: true,
      title: tt(locale, 'pdfFooterOfficeTitle'),
      lines: ['Prima Vista Bauprojekte', 'Gref-Völsing-Straße 13', '60314 Frankfurt am Main'],
    },
    {
      x: PAGE.marginX + 154,
      width: 136,
      isOffice: false,
      title: tt(locale, 'pdfFooterContactTitle'),
      lines: [
        tt(locale, 'contactPrimaryLabel'),
        businessContact.primary.display,
        tt(locale, 'contactSecondaryLabel'),
        businessContact.secondary.display,
        tt(locale, 'pdfFooterEmail'),
      ],
    },
    {
      x: PAGE.marginX + 316,
      width: 116,
      isOffice: false,
      title: tt(locale, 'pdfFooterLegalTitle'),
      lines: [tt(locale, 'pdfFooterTaxNr'), tt(locale, 'pdfFooterVatId'), tt(locale, 'pdfFooterCourt')],
    },
    {
      x: PAGE.marginX + 444,
      width: 104,
      isOffice: false,
      title: tt(locale, 'pdfFooterSwitzerlandTitle'),
      lines: ['Emmenbrücke / Luzern', businessContact.swiss.display, 'info@primavista-bauprojekte.ch'],
    },
  ];

  doc.save();
  doc.moveTo(PAGE.marginX, y - 18).lineTo(PAGE.width - PAGE.marginX, y - 18).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.5);
  doc.text(interpolate(tt(locale, 'pdfFooterPage'), { n: pageNumber, total: totalPages }), PAGE.width - PAGE.marginX - 72, y - 35, { width: 72, align: 'right', lineBreak: false });

  for (const column of columns) {
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(6.8).text(column.title, column.x, y, {
      width: column.width,
      lineBreak: false,
    });
    column.lines.forEach((line, index) => {
      doc
        .fillColor(index === 0 && column.isOffice ? COLORS.copper : COLORS.ink)
        .font(index === 0 && column.isOffice ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(6.4)
        .text(line, column.x, y + 13 + (index * 10), { width: column.width, lineBreak: false });
    });
  }
  doc.restore();
}

function addStaticBrandBand(doc: PDFKit.PDFDocument, locale: Locale) {
  const logo = getLogoBuffer();
  const logoSize = 54;
  const x = PAGE.marginX;
  const y = 34;
  const wordmarkX = logo ? x + logoSize + 16 : x;

  doc.save();
  doc.rect(0, 0, PAGE.width, 116).fill(COLORS.ink);
  if (logo) {
    doc.roundedRect(x, y - 4, logoSize, logoSize, 7).fillOpacity(0.1).fill(COLORS.bone).fillOpacity(1);
    doc.image(logo, x + 6, y + 2, { fit: [42, 42], align: 'center', valign: 'center' });
  }
  doc
    .fillColor(COLORS.bone)
    .font('Helvetica-Bold')
    .fontSize(26)
    .text('PRIMA VISTA', wordmarkX, y, { continued: true })
    .fillColor(COLORS.copper)
    .text(' BAUPROJEKTE');
  doc
    .fillColor(COLORS.faint)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(tt(locale, 'pdfBandTagline'), wordmarkX, y + 33, { characterSpacing: 1.8 });
  doc.restore();
}

function fieldBox(doc: PDFKit.PDFDocument, label: string, x: number, y: number, width: number) {
  const height = 28;
  doc.save();
  doc.roundedRect(x, y, width, height, 3).strokeColor('#9b9690').lineWidth(0.9).stroke();
  doc.fillColor('#aaa5a0').font('Helvetica').fontSize(8.5).text(label, x + 7, y + 9, {
    width: width - 14,
    lineBreak: false,
  });
  doc.restore();
}

function addAddressColumn(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number, locale: Locale) {
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(16).text(title, x, y, {
    width,
    align: 'center',
    lineBreak: false,
  });

  let fieldY = y + 42;
  ADDRESS_FIELD_KEYS.forEach((key) => {
    fieldBox(doc, tt(locale, key), x, fieldY, width);
    fieldY += 40;
  });
}

function addProjectDetailsPage(doc: PDFKit.PDFDocument, payload: CalculatorPdfPayload, locale: Locale) {
  const x = PAGE.marginX;
  const contentWidth = PAGE.width - (PAGE.marginX * 2);
  const sourceUrl = payload.sourceUrl || DEFAULT_SOURCE_URL;

  addStaticBrandBand(doc, locale);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(tt(locale, 'pdfProjectDataTitle'), x, 154, { width: contentWidth, align: 'center' });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(tt(locale, 'pdfProjectDataIntro'), x, 184, {
      width: contentWidth,
      align: 'center',
    });

  const linkY = 225;
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(tt(locale, 'pdfLinkLabel'), x, linkY, {
    width: 126,
    lineBreak: false,
  });
  doc.fillColor(COLORS.link).font('Helvetica-Bold').fontSize(9).text(sourceUrl, x + 130, linkY, {
    width: contentWidth - 130,
    link: sourceUrl,
    underline: true,
  });

  const gap = 24;
  const columnWidth = (contentWidth - gap) / 2;
  addAddressColumn(doc, tt(locale, 'pdfBillingAddress'), x, 285, columnWidth, locale);
  addAddressColumn(doc, tt(locale, 'pdfProjectAddress'), x + columnWidth + gap, 285, columnWidth, locale);

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(tt(locale, 'pdfAddressHint'), x, 610, {
      width: contentWidth,
      lineGap: 2,
    });
}

function confirmationCard(doc: PDFKit.PDFDocument, number: string, title: string, body: string, y: number, locale: Locale): number {
  const x = PAGE.marginX;
  const width = PAGE.width - (PAGE.marginX * 2);
  const height = 76;
  const numberSize = 28;

  doc.save();
  doc.roundedRect(x, y, width, height, 5).fill(COLORS.paper).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
  doc.roundedRect(x + 14, y + 16, numberSize, numberSize, 4).fill(COLORS.ink);
  doc.fillColor(COLORS.copper).font('Helvetica-Bold').fontSize(10).text(number, x + 14, y + 24, {
    width: numberSize,
    align: 'center',
    lineBreak: false,
  });
  doc.rect(x + width - 72, y + 18, 11, 11).strokeColor(COLORS.muted).lineWidth(0.8).stroke();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(tt(locale, 'pdfSignConfirmed'), x + width - 56, y + 18, {
    width: 46,
    lineBreak: false,
  });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9.8)
    .text(title, x + 56, y + 14, { width: width - 138, lineBreak: false });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.4)
    .text(body, x + 56, y + 34, { width: width - 84, lineGap: 1.8 });
  doc.restore();

  return y + height + 12;
}

function finalSignatureBlock(doc: PDFKit.PDFDocument, y: number, locale: Locale) {
  const x = PAGE.marginX;
  const width = PAGE.width - (PAGE.marginX * 2);
  const leftWidth = 180;
  const rightWidth = 250;

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(tt(locale, 'pdfSignFinalTitle'), x, y, { width });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.4)
    .text(tt(locale, 'pdfSignFinalBody'), x, y + 18, {
      width,
      lineGap: 1.8,
    });

  const lineY = y + 62;
  doc.save();
  doc.strokeColor('#807973').lineWidth(0.8);
  doc.moveTo(x, lineY).lineTo(x + leftWidth, lineY).stroke();
  doc.moveTo(x + width - rightWidth, lineY).lineTo(x + width, lineY).stroke();
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.5);
  doc.text(tt(locale, 'pdfSignDatePlace'), x, lineY + 8, { width: leftWidth, align: 'center' });
  doc.text(tt(locale, 'pdfSignSignature'), x + width - rightWidth, lineY + 8, { width: rightWidth, align: 'center' });
  doc.restore();
}

function addSignaturePage(doc: PDFKit.PDFDocument, locale: Locale) {
  addStaticBrandBand(doc, locale);

  const contentWidth = PAGE.width - (PAGE.marginX * 2);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(tt(locale, 'pdfSignTitle'), PAGE.marginX, 150, {
      width: PAGE.width - (PAGE.marginX * 2),
      align: 'center',
    });

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(tt(locale, 'pdfSignIntro'), PAGE.marginX, 182, {
      width: contentWidth,
      align: 'center',
      lineGap: 2,
    });

  let y = 222;
  y = confirmationCard(doc, '01', tt(locale, 'pdfSignCard1Title'), tt(locale, 'pdfSignCard1Body'), y, locale);
  y = confirmationCard(doc, '02', tt(locale, 'pdfSignCard2Title'), tt(locale, 'pdfSignCard2Body'), y, locale);
  y = confirmationCard(doc, '03', tt(locale, 'pdfSignCard3Title'), tt(locale, 'pdfSignCard3Body'), y, locale);
  y = confirmationCard(doc, '04', tt(locale, 'pdfSignCard4Title'), tt(locale, 'pdfSignCard4Body'), y, locale);
  finalSignatureBlock(doc, y + 8, locale);
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number, locale: Locale) {
  if (doc.y + height <= PAGE.height - PAGE.bottom) return;
  doc.addPage();
  addHeader(doc, tt(locale, 'pdfTitleEstimate'), locale);
}

function summaryBox(doc: PDFKit.PDFDocument, payload: CalculatorPdfPayload, locale: Locale) {
  const handoff = payload.kalkulator;
  const totalNet = handoff.totalMid;
  const totalVat = totalNet * 0.19;
  const totalGross = totalNet + totalVat;
  const x = PAGE.marginX;
  const y = doc.y;
  const width = PAGE.width - (PAGE.marginX * 2);

  doc.save();
  doc.roundedRect(x, y, width, 130, 6).fill(COLORS.paper).stroke(COLORS.rule);
  doc.fillColor(COLORS.copper).font('Helvetica-Bold').fontSize(8).text(tt(locale, 'pdfSummaryEyebrow'), x + 18, y + 16, { characterSpacing: 1.8 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15).text(cleanLabel(handoff.kindLabel), x + 18, y + 38, { width: 250 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(interpolate(tt(locale, 'pdfSummaryScope'), { label: handoff.scopeLabel || tt(locale, 'pdfScopeDefault'), value: formatScope(handoff, locale) }), x + 18, y + 60, { width: 250 });
  doc.text(interpolate(tt(locale, 'pdfSummaryEstimate'), { min: formatEuro(handoff.totalMin, locale, false), max: formatEuro(handoff.totalMax, locale, false) }), x + 18, y + 76, { width: 250 });
  if (handoff.perM2 > 0) doc.text(interpolate(tt(locale, 'pdfSummaryGuide'), { value: formatEuro(handoff.perM2, locale, false) }), x + 18, y + 92, { width: 250 });

  const rightX = x + width - 190;
  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8).text(tt(locale, 'pdfSummaryTotal'), rightX, y + 18, { characterSpacing: 1.4 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(18).text(formatEuro(totalGross, locale), rightX, y + 38, { width: 172, align: 'right' });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
  doc.text(interpolate(tt(locale, 'pdfSummaryNet'), { value: formatEuro(totalNet, locale) }), rightX, y + 70, { width: 172, align: 'right' });
  doc.text(interpolate(tt(locale, 'pdfSummaryVat'), { value: formatEuro(totalVat, locale) }), rightX, y + 86, { width: 172, align: 'right' });
  doc.restore();
  doc.y = y + 154;
}

function tableHeader(doc: PDFKit.PDFDocument, locale: Locale) {
  const x = PAGE.marginX;
  ensureSpace(doc, 34, locale);
  const y = doc.y;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9);
  doc.text(tt(locale, 'pdfTableProduct'), x, y, { width: 255 });
  doc.text(tt(locale, 'pdfTableCount'), x + 280, y, { width: 60, align: 'right' });
  doc.text(tt(locale, 'pdfTableUnitPrice'), x + 350, y, { width: 78, align: 'right' });
  doc.text(tt(locale, 'pdfTableTotalNet'), x + 440, y, { width: 68, align: 'right' });
  doc.moveTo(x, y + 18).lineTo(PAGE.width - PAGE.marginX, y + 18).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
  doc.y = y + 32;
}

function addGroupRow(doc: PDFKit.PDFDocument, label: string, subtotal: number, locale: Locale) {
  ensureSpace(doc, 32, locale);
  const y = doc.y;
  doc.rect(PAGE.marginX, y, PAGE.width - (PAGE.marginX * 2), 24).fill(COLORS.paper);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(cleanLabel(label), PAGE.marginX + 8, y + 7, { width: 330 });
  doc.text(formatEuro(subtotal, locale), PAGE.width - PAGE.marginX - 100, y + 7, { width: 92, align: 'right' });
  doc.y = y + 34;
}

function addItemRow(doc: PDFKit.PDFDocument, handoff: KalkulatorHandoff, line: KalkulatorRow | KalkulatorPick, nested: boolean, locale: Locale) {
  const x = PAGE.marginX;
  const label = cleanLabel(line.label);
  const descHeight = doc.font('Helvetica').fontSize(8).heightOfString(label, { width: 255 });
  const rowHeight = Math.max(32, descHeight + 18);
  ensureSpace(doc, rowHeight + 6, locale);

  const y = doc.y;
  doc.moveTo(x, y - 6).lineTo(PAGE.width - PAGE.marginX, y - 6).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
  doc
    .fillColor(COLORS.ink)
    .font(nested ? 'Helvetica' : 'Helvetica-Bold')
    .fontSize(8.5)
    .text(label, x + (nested ? 14 : 0), y, { width: nested ? 241 : 255, lineGap: 2 });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(lineQuantity(line, handoff, locale), x + 280, y, { width: 60, align: 'right' });
  doc.text(formatEuro(lineUnitPrice(line, handoff), locale), x + 350, y, { width: 78, align: 'right' });
  doc.fillColor(COLORS.ink).text(formatEuro(line.subtotal, locale), x + 440, y, { width: 68, align: 'right' });
  doc.y = y + rowHeight;
}

function addTotals(doc: PDFKit.PDFDocument, handoff: KalkulatorHandoff, locale: Locale) {
  const totalNet = handoff.totalMid;
  const totalVat = totalNet * 0.19;
  const totalGross = totalNet + totalVat;
  ensureSpace(doc, 110, locale);
  const x = PAGE.width - PAGE.marginX - 220;
  const y = doc.y + 4;
  const rows = [
    [tt(locale, 'pdfTotalNetSum'), formatEuro(totalNet, locale)],
    [tt(locale, 'pdfTotalVat'), formatEuro(totalVat, locale)],
    [tt(locale, 'pdfTotalGross'), formatEuro(totalGross, locale)],
  ];
  doc.fontSize(9);
  rows.forEach(([label, value], index) => {
    const rowY = y + (index * 24);
    doc.fillColor(index === 2 ? COLORS.ink : COLORS.muted).font(index === 2 ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(label, x, rowY, { width: 110 });
    doc.text(value, x + 112, rowY, { width: 108, align: 'right' });
    doc.moveTo(x, rowY + 16).lineTo(x + 220, rowY + 16).strokeColor(index === 1 ? COLORS.ink : COLORS.rule).lineWidth(index === 1 ? 1 : 0.5).stroke();
  });
  doc.y = y + 72;
}

// All PDF thumbnails live under public/. `image`/`sku` arrive from the public
// calculator-pdf payload, so every constructed path must be confined to this
// directory — otherwise a value like '../../../etc/secret.png' would let an
// attacker read an arbitrary image-extension file into the emailed PDF.
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function withinPublic(candidate: string): string | null {
  const resolved = path.resolve(candidate);
  return resolved === PUBLIC_DIR || resolved.startsWith(PUBLIC_DIR + path.sep) ? resolved : null;
}

function candidatePdfImagePaths(image?: string, sku?: string): string[] {
  const candidates: string[] = [];
  if (image && !image.includes('..') && !image.includes('\\') && !image.includes('\0')) {
    const normalized = image.startsWith('/') ? image.slice(1) : image;
    candidates.push(path.join(PUBLIC_DIR, normalized));
  }

  if (sku) {
    ['.png', '.jpg', '.jpeg'].forEach((ext) => {
      candidates.push(path.join(PUBLIC_DIR, 'assets', 'img', 'products', `${sku}${ext}`));
    });
    if (/-MON$/i.test(sku)) {
      candidates.push(path.join(PUBLIC_DIR, 'assets', 'img', 'products', 'MON-100-stk.jpg'));
    }
  }

  // Drop any candidate that escapes public/ (defends against traversal in a
  // crafted `sku` as well as `image`).
  return candidates
    .map(withinPublic)
    .filter((candidate): candidate is string => candidate !== null);
}

function resolvePdfImagePath(detail: ProductDetail): string | null {
  const candidates = candidatePdfImagePaths(detail.image, detail.sku);
  const imagePath = candidates.find((candidate) => existsSync(candidate));
  if (!imagePath) return null;
  const ext = path.extname(imagePath).toLocaleLowerCase();
  return ext === '.png' || ext === '.jpg' || ext === '.jpeg' ? imagePath : null;
}

function ensureProductDetailSpace(doc: PDFKit.PDFDocument, height: number, locale: Locale) {
  if (doc.y + height <= PAGE.height - PAGE.bottom) return;
  doc.addPage();
  addHeader(doc, tt(locale, 'pdfTitleProductDetails'), locale);
}

function addProductThumb(doc: PDFKit.PDFDocument, detail: ProductDetail, x: number, y: number) {
  const size = 78;
  const imagePath = resolvePdfImagePath(detail);

  doc.save();
  doc.roundedRect(x, y, size, size, 2).fill(COLORS.paper).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
  let drewImage = false;
  if (imagePath) {
    try {
      doc.image(imagePath, x + 5, y + 5, {
        fit: [size - 10, size - 10],
        align: 'center',
        valign: 'center',
      });
      drewImage = true;
    } catch (err) {
      // A corrupt/unsupported image must not abort the whole PDF (which would
      // 502 the entire send) — fall back to the SKU-prefix placeholder.
      console.warn('[calculatorPdf] thumbnail render failed, using placeholder', err);
    }
  }
  if (!drewImage) {
    doc
      .fillColor(COLORS.copper)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(readableSkuPrefix(detail), x, y + 28, { width: size, align: 'center', lineBreak: false });
  }
  doc.restore();
}

function productMetaText(detail: ProductDetail, locale: Locale): string {
  const quantity = detail.quantity != null && detail.unit ? formatQuantity(detail.quantity, detail.unit, locale) : '';
  return [
    detail.sku ? interpolate(tt(locale, 'pdfProductProdNr'), { sku: detail.sku }) : '',
    detail.type ? interpolate(tt(locale, 'pdfProductType'), { type: detail.type }) : '',
    quantity ? interpolate(tt(locale, 'pdfProductQuantity'), { value: quantity }) : '',
    detail.unitPrice != null ? interpolate(tt(locale, 'pdfProductUnitPrice'), { value: formatEuro(detail.unitPrice, locale) }) : '',
    interpolate(tt(locale, 'pdfProductTotalNet'), { value: formatEuro(detail.subtotal, locale) }),
  ].filter(Boolean).join('  ·  ');
}

function addProductMeta(doc: PDFKit.PDFDocument, detail: ProductDetail, x: number, y: number, width: number, locale: Locale) {
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.2)
    .text(productMetaText(detail, locale), x, y, { width, lineGap: 1.5 });
}

function addProductDetailCard(doc: PDFKit.PDFDocument, detail: ProductDetail, locale: Locale) {
  const x = PAGE.marginX;
  const thumbSize = 78;
  const gap = 18;
  const copyX = x + thumbSize + gap;
  const copyWidth = PAGE.width - PAGE.marginX - copyX;
  const title = cleanLabel(detail.label);
  const description = compactDescription(detail, locale);
  const titleHeight = doc.font('Helvetica-Bold').fontSize(10.8).heightOfString(title, { width: copyWidth, lineGap: 1.5 });
  const metaHeight = doc.font('Helvetica').fontSize(8.2).heightOfString(productMetaText(detail, locale), { width: copyWidth, lineGap: 1.5 });
  const descHeight = doc.font('Helvetica').fontSize(8.8).heightOfString(description, { width: copyWidth, lineGap: 2.2 });
  const rowHeight = Math.max(thumbSize, titleHeight + metaHeight + descHeight + 19);

  ensureProductDetailSpace(doc, rowHeight + 18, locale);
  const cardY = doc.y;
  addProductThumb(doc, detail, x, cardY);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(10.8)
    .text(title, copyX, cardY, { width: copyWidth, lineGap: 1.5 });
  addProductMeta(doc, detail, copyX, doc.y + 4, copyWidth, locale);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8.8)
    .text(description, copyX, doc.y + 9, { width: copyWidth, lineGap: 2.2 });

  doc.y = cardY + rowHeight + 18;
}

function addProductDetails(doc: PDFKit.PDFDocument, handoff: KalkulatorHandoff, locale: Locale) {
  const details = collectProductDetails(handoff);
  if (details.length === 0) return;

  doc.addPage();
  addHeader(doc, tt(locale, 'pdfTitleProductDetails'), locale);
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(tt(locale, 'pdfProductDetailsIntro'), PAGE.marginX, doc.y, {
      width: PAGE.width - (PAGE.marginX * 2),
      align: 'center',
      lineGap: 2,
    });
  doc.y += 28;

  let currentCategory = '';
  for (const detail of details) {
    if (detail.category !== currentCategory) {
      ensureProductDetailSpace(doc, 150, locale);
      currentCategory = detail.category;
      doc
        .fillColor(COLORS.ink)
        .font('Helvetica-BoldOblique')
        .fontSize(11)
        .text(currentCategory, PAGE.marginX, doc.y, { width: PAGE.width - (PAGE.marginX * 2) });
      if (detail.subcategory) {
        doc
          .fillColor(COLORS.copper)
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(detail.subcategory.toLocaleUpperCase('de-DE'), PAGE.marginX, doc.y + 4, {
            width: PAGE.width - (PAGE.marginX * 2),
            characterSpacing: 1.3,
          });
      }
      doc.y += 20;
    }
    addProductDetailCard(doc, detail, locale);
  }
}

export async function buildCalculatorPdf(
  payload: CalculatorPdfPayload,
  options: CalculatorPdfOptions = {},
): Promise<Buffer> {
  const locale = normalizeLocale(payload.locale);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.top, bottom: 36, left: PAGE.marginX, right: PAGE.marginX },
    bufferPages: true,
    info: {
      Title: interpolate(tt(locale, 'pdfDocTitle'), { kind: cleanLabel(payload.kalkulator.kindLabel) }),
      Author: 'Prima Vista Bauprojekte',
      Subject: tt(locale, 'pdfDocSubject'),
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  addProjectDetailsPage(doc, payload, locale);

  doc.addPage();
  addHeader(doc, tt(locale, 'pdfTitleEstimate'), locale);
  summaryBox(doc, payload, locale);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(tt(locale, 'pdfPositionsTitle'), PAGE.marginX, doc.y);
  doc.moveDown(0.8);
  tableHeader(doc, locale);

  for (const group of groupCalculatorPicks(payload.kalkulator.picks)) {
    addGroupRow(doc, group.label, group.subtotal, locale);
    for (const item of group.items) {
      if (item.rows && item.rows.length > 0) {
        for (const row of item.rows) addItemRow(doc, payload.kalkulator, row, true, locale);
      } else {
        addItemRow(doc, payload.kalkulator, item, false, locale);
      }
    }
  }

  if (collectLineItems(payload.kalkulator).length === 0) {
    ensureSpace(doc, 30, locale);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(tt(locale, 'pdfNoPositions'), PAGE.marginX, doc.y);
    doc.y += 24;
  }

  addTotals(doc, payload.kalkulator, locale);
  const disclaimer = tt(locale, 'pdfDisclaimer');
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).lineGap(3);
  const disclaimerHeight = doc.heightOfString(disclaimer, { width: PAGE.width - (PAGE.marginX * 2) });
  ensureSpace(doc, disclaimerHeight + 14, locale);
  doc.text(disclaimer, PAGE.marginX, doc.y, { width: PAGE.width - (PAGE.marginX * 2) });

  if (options.includeProductDetails !== false) {
    addProductDetails(doc, payload.kalkulator, locale);
  }

  doc.addPage();
  addSignaturePage(doc, locale);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, range.count, locale);
  }

  doc.end();
  return await done;
}

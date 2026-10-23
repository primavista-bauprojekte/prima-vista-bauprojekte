import { describe, expect, it } from 'vitest';

import { renderBlitzEmails, type BlitzPayload } from '../../server/mail';

const sampleBlitzPayload: BlitzPayload = {
  art: 'gewerke',
  artLabel: 'Gewerke',
  groesse: '80 m² Boden, 12 Türen',
  starttermin: '1-3m',
  starterminLabel: 'In 1 – 3 Monaten',
  gewerke: ['Bäder & Sanitär', 'Böden & Beläge', 'Türen & Zargen'],
  msg: 'Altbau, Zugang über Innenhof. Bitte zuerst grob einschätzen.',
  name: 'Max Mustermann',
  email: 'max@example.com',
  tel: '+49 170 1234567',
  kalkulator: {
    kind: 'gewerke',
    kindLabel: 'Gewerke',
    scopeLabel: 'Geschätzter Umfang',
    area: 80,
    totalMin: 18000,
    totalMax: 25000,
    totalMid: 21500,
    perM2: 269,
    picks: [
      {
        key: 'boeden',
        label: 'Böden & Beläge',
        subtotal: 12500,
        tradeKey: 'boeden',
        tradeLabel: 'Böden & Beläge',
        rows: [
          {
            label: 'Parkett schleifen und versiegeln',
            quantity: 80,
            unit: 'm²',
            unitPrice: 90,
            subtotal: 7200,
          },
        ],
      },
      {
        key: 'tueren',
        label: 'Türen & Zargen',
        subtotal: 9000,
        tradeKey: 'tueren',
        tradeLabel: 'Türen & Zargen',
        rows: [
          {
            label: 'Innentür mit Zarge',
            quantity: 12,
            unit: 'Stk.',
            unitPrice: 750,
            subtotal: 9000,
          },
        ],
      },
    ],
  },
};

describe('Blitz email rendering', () => {
  it('renders clear office and customer emails without PDF attachments', () => {
    const emails = renderBlitzEmails(sampleBlitzPayload);

    expect(emails.office.subject).toContain('Blitzanfrage');
    expect(emails.office.replyTo).toBe('max@example.com');
    expect(emails.office.html).toContain('Gewählte Leistungen / Anfragebereich');
    expect(emails.office.html).toContain('Übernommene Kalkulation');
    expect(emails.office.html).toContain('Parkett schleifen und versiegeln');
    expect(emails.office.html).toContain('Nächster Schritt');
    expect(emails.office.html).not.toContain('Reply geht');

    expect(emails.customer.to).toBe('max@example.com');
    expect(emails.customer.subject).toContain('Ihre Blitzanfrage ist eingegangen');
    expect(emails.customer.html).toContain('Ihre Angaben');
    expect(emails.customer.html).toContain('Ihre ausgewählten Leistungen');
    expect(emails.customer.html).toContain('So geht es weiter');
    expect(emails.customer.html).not.toMatch(/PDF|Anhang/i);
    expect('attachments' in emails.office).toBe(false);
    expect('attachments' in emails.customer).toBe(false);
  });

  it('keeps the plain text fallback readable', () => {
    const emails = renderBlitzEmails(sampleBlitzPayload);

    expect(emails.office.text).toContain('Gewählte Leistungen / Anfragebereich:');
    expect(emails.office.text).toContain('· Bäder & Sanitär');
    expect(emails.office.text).toContain('Übernommene Kalkulation');
    expect(emails.office.text).toContain('Parkett schleifen und versiegeln');

    expect(emails.customer.text).toContain('Ihre ausgewählten Leistungen:');
    expect(emails.customer.text).toContain('· Böden & Beläge');
    expect(emails.customer.text).toContain('So geht es weiter:');
    expect(emails.customer.text).not.toMatch(/PDF|Anhang/i);
  });

  it('renders legacy calculator summaries as calculator blocks instead of customer notes', () => {
    const emails = renderBlitzEmails({
      ...sampleBlitzPayload,
      art: 'anderes',
      artLabel: 'Haus',
      groesse: '1',
      gewerke: [],
      kalkulator: undefined,
      msg: [
        '— Aus dem Kalkulator übernommen —',
        'Objektart: Heizkörper',
        'Fläche: 1 m²',
        'Vorab-Schätzung: € 1 Tsd. – € 1 Tsd. (Mittelwert € 1 Tsd. · ca. € 898 / m²)',
        '',
        'Gewählte Gewerke:',
        '• Heizung — € 898',
        '– Art der Ausführung — € 149',
        '· HEIZKÖRPER | Montage (1 Stk) — € 149',
        '– Material — € 749',
      ].join('\n'),
    });

    expect(emails.office.subject).toContain('1 m² Heizkörper');
    expect(emails.customer.html).toContain('Rechner');
    expect(emails.customer.html).toContain('Heizkörper');
    expect(emails.customer.html).toContain('Ihre übernommene Kalkulation');
    expect(emails.customer.html).not.toContain('Ihre Notiz');
    expect(emails.customer.html).not.toContain('Noch keine Vorauswahl');
    expect(emails.customer.text).toContain('· Anfrage: Aus dem Kalkulator übernommen');
    expect(emails.customer.text).toContain('· Rechner: Heizkörper');
    expect(emails.customer.text).toContain('Ihre übernommene Kalkulation:');
    expect(emails.customer.text).not.toContain('Ihre ausgewählten Leistungen:');
  });
});

describe('Blitz email localization (customer confirmation)', () => {
  it.each([
    ['de', 'Hauptkontakt', 'Alternativer Kontakt (Sonja)'],
    ['en', 'Primary contact', 'Alternative contact (Sonja)'],
    ['it', 'Contatto principale', 'Contatto alternativo (Sonja)'],
    ['fr', 'Contact principal', 'Autre contact (Sonja)'],
  ] as const)('keeps the primary and alternative contacts consistent in %s HTML and text', (locale, primaryLabel, secondaryLabel) => {
    const { customer, office } = renderBlitzEmails({ ...sampleBlitzPayload, locale });
    expect(customer.html).toContain(`<html lang="${locale}">`);
    for (const email of [customer, office]) {
      expect(email.html).toContain('href="tel:+4917648747554"');
      expect(email.html).toContain('href="tel:+4915789818308"');
      expect(email.html.indexOf('+49 176 48747554')).toBeLessThan(email.html.indexOf('+49 1578 9818308'));
    }
    expect(customer.html).toContain(primaryLabel);
    expect(customer.html).toContain(secondaryLabel);
    expect(customer.text).toContain(`${primaryLabel}: +49 176 48747554`);
    expect(customer.text).toContain(`${secondaryLabel}: +49 1578 9818308`);
    expect(office.html).toContain('Hauptkontakt');
    expect(office.html).toContain('Alternativer Kontakt (Sonja)');
  });

  it('defaults to German when no locale is provided', () => {
    const emails = renderBlitzEmails(sampleBlitzPayload);
    expect(emails.customer.subject).toBe('Ihre Blitzanfrage ist eingegangen — Prima Vista Bauprojekte');
    expect(emails.customer.html).toContain('Ihre Angaben');
    expect(emails.customer.text).toContain('So geht es weiter:');
  });

  it('renders the customer confirmation in English while keeping the office email German', () => {
    const emails = renderBlitzEmails({ ...sampleBlitzPayload, locale: 'en' });

    // Customer: localized to English.
    expect(emails.customer.subject).toBe('We have received your express quote request — Prima Vista Bauprojekte');
    expect(emails.customer.html).toContain('Thank you, Max.');
    expect(emails.customer.html).toContain('Your details');
    expect(emails.customer.html).toContain('Your selected services');
    expect(emails.customer.html).toContain('What happens next');
    expect(emails.customer.html).toContain('Kind regards,');
    expect(emails.customer.html).not.toContain('Ihre Angaben');
    expect(emails.customer.text).toContain('What happens next:');
    expect(emails.customer.text).toContain('Your transferred calculation');
    // Canonical German gewerke codes are mapped to localized trade labels in
    // the customer email (the POSTed values stay German per the server contract).
    expect(emails.customer.text).toContain('Doors & frames');

    // Office: stays German regardless of request locale.
    expect(emails.office.subject).toContain('Blitzanfrage');
    expect(emails.office.html).toContain('Gewählte Leistungen / Anfragebereich');
    expect(emails.office.html).toContain('Übernommene Kalkulation');
    expect(emails.office.html).not.toMatch(/What happens next|Kind regards/);
  });

  it('renders the customer confirmation in Italian (formal Lei) while keeping the office email German', () => {
    const emails = renderBlitzEmails({ ...sampleBlitzPayload, locale: 'it' });

    expect(emails.customer.subject).toBe('Abbiamo ricevuto la Sua richiesta di preventivo express — Prima Vista Bauprojekte');
    expect(emails.customer.html).toContain('Grazie, Max.');
    expect(emails.customer.html).toContain('I Suoi dati');
    expect(emails.customer.html).toContain('Le lavorazioni selezionate');
    expect(emails.customer.html).toContain('Come si procede');
    expect(emails.customer.html).toContain('Cordiali saluti,');
    expect(emails.customer.text).toContain('Porte & telai');

    // Office: German.
    expect(emails.office.html).toContain('Gewählte Leistungen / Anfragebereich');
    expect(emails.office.html).not.toMatch(/Come si procede|Cordiali saluti/);
  });
});

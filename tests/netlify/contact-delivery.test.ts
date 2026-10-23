import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

let contact: (request: Request) => Promise<Response>;

const payload = {
  vorname: 'Ada',
  nachname: 'Lovelace',
  email: 'ada@example.com',
  msg: 'Bitte um Rückmeldung zu meinem Projekt.',
  dsgvo: true,
  locale: 'en',
};

function request(body: unknown) {
  return new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-not-a-real-key');
  vi.stubEnv('MAIL_DRY_RUN', '0');
  vi.stubEnv('MAIL_TO_OFFICE', 'office@example.com');
  vi.stubEnv('MAIL_FROM', 'Website <noreply@example.com>');
  contact = (await import('../../netlify/functions/contact')).default;
});

beforeEach(() => {
  globalThis.__pvRateLimit?.clear();
  send.mockReset().mockResolvedValue({ data: { id: 'test-email' }, error: null });
});

afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

describe('contact form delivery contract with a mocked mail provider', () => {
  it('routes the enquiry to the configured office and returns a localized acknowledgement', async () => {
    const response = await contact(request(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(2);
    const [office, customer] = send.mock.calls.map(([email]) => email);
    expect(office).toMatchObject({ to: 'office@example.com', replyTo: 'ada@example.com' });
    expect(customer).toMatchObject({ to: 'ada@example.com', replyTo: 'office@example.com' });
    expect(office.html).toContain(payload.msg);
    expect(customer.html).toContain('Primary contact');
    expect(customer.html).toContain('Alternative contact (Sonja)');
    for (const email of [office, customer]) {
      expect(email.html).toContain('href="tel:+4917648747554"');
      expect(email.html).toContain('href="tel:+4915789818308"');
    }
    expect(customer.text).toContain('Primary contact: +49 176 48747554');
  });

  it('rejects incomplete forms without calling the provider', async () => {
    const response = await contact(request({ ...payload, email: 'invalid' }));
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('reports office delivery failure without claiming success or sending an acknowledgement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'Mock rejection' } });
    const response = await contact(request(payload));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Send failed' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports acknowledgement failure even when the office notification was accepted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockResolvedValueOnce({ data: { id: 'office-email' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'Mock rejection' } });
    const response = await contact(request(payload));
    expect(response.status).toBe(502);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

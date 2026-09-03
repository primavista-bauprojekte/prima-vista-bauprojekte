import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processBlitzSubmission } from '../../server/blitzFlow.js';
import handler from '../../netlify/functions/blitz';

vi.mock('../../server/blitzFlow.js', () => ({ processBlitzSubmission: vi.fn() }));
vi.mock('../../netlify/functions/_shared/db', () => ({
  connectDb: vi.fn(async () => ({ BlitzRequest: {} })),
}));

const validBody = {
  name: 'Test Person', email: 'test@example.com', tel: '+4912345678',
  art: 'gewerke', starttermin: 'sofort', dsgvo: true,
};

function request(body: object = validBody) {
  return new Request('https://example.test/api/blitz', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(processBlitzSubmission).mockReset();
  globalThis.__pvRateLimit = new Map();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Blitz tracking acknowledgement', () => {
  it.each([false, true])('reports the server duplicate decision (%s) without changing success UX', async (duplicate) => {
    vi.mocked(processBlitzSubmission).mockResolvedValue({ mode: 'auto', duplicate });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, mode: 'auto', duplicate });
  });

  it('acknowledges an accepted manual enquiry as nonduplicate', async () => {
    vi.mocked(processBlitzSubmission).mockResolvedValue({ mode: 'manual', duplicate: false });
    const response = await handler(request());
    expect(await response.json()).toEqual({ ok: true, mode: 'manual', duplicate: false });
  });

  it('rejects honeypots before enquiry processing', async () => {
    const response = await handler(request({ ...validBody, website: 'https://spam.example' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Spam detected' });
    expect(processBlitzSubmission).not.toHaveBeenCalled();
  });

  it('never acknowledges a failed submission as a lead', async () => {
    vi.mocked(processBlitzSubmission).mockRejectedValue(new Error('Email failure'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Send failed' });
  });
});

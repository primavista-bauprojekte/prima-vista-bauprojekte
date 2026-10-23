import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatStream } from '../../server/chat';

const messages = [{ role: 'user' as const, content: 'How can I estimate renovation costs?' }];

function providerStream() {
  const events = [
    { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Use the calculator' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' at /kalkulator.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } },
    { type: 'message_stop' },
  ];
  return new Response(events.map((event) => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('chat through the actual Anthropic SDK', () => {
  it.each([
    ['de', null],
    ['en', 'Englisch'],
    ['fr', 'Französisch'],
    ['it', 'Italienisch'],
  ])('preserves streamed text and the %s language contract', async (locale, instruction) => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-not-a-real-key');
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      expect(request.url).toBe('https://api.anthropic.com/v1/messages');
      return providerStream();
    }));

    const output = await new Response(createChatStream(messages, locale)).text();
    expect(output.split('\n\n').filter(Boolean).map((line) => JSON.parse(line.slice(6)))).toEqual([
      { text: 'Use the calculator' },
      { text: ' at /kalkulator.' },
      { done: true },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers.get('x-api-key')).toBe('test-not-a-real-key');
    const body = await requests[0].json();
    expect(body.messages).toEqual(messages);
    expect(body.stream).toBe(true);
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system[0].text).toContain('Hauptkontakt DE: +49 176 48747554');
    expect(body.system[0].text).toContain('Alternativer Kontakt DE (Sonja): +49 1578 9818308');
    expect(body.system[0].text).toContain('Telefon CH: +41 78 265 93 32');
    if (instruction) expect(body.system[1].text).toContain(instruction);
    else expect(body.system).toHaveLength(1);
  });

  it('finishes with a safe error when the provider rejects a request', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-not-a-real-key');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      type: 'error', error: { type: 'invalid_request_error', message: 'private-provider-detail' },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const output = await new Response(createChatStream(messages, 'en')).text();
    expect(output).toBe('data: {"error":"CHAT_UNAVAILABLE"}\n\n');
    expect(output).not.toContain('private-provider-detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not contact the provider when no key is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const fetchMock = vi.fn(() => { throw new Error('Unexpected network request'); });
    vi.stubGlobal('fetch', fetchMock);
    expect(await new Response(createChatStream(messages)).text()).toBe('data: {"error":"CHAT_UNAVAILABLE"}\n\n');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

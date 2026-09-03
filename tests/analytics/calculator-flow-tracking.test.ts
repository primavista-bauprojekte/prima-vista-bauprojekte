import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { KalkulatorHandoff } from '../../src/data/blitzAngebot';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: object }[],
  stateIndex: 0,
  refIndex: 0,
}));

// Run the component's actual handlers with persistent hook cells, but without
// mounting effects, loading a browser or sending any real request/GA event.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: () => {},
    useId: () => 'test-id',
    useMemo: (factory: () => unknown) => factory(),
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (value: unknown) => {
        hooks.states[index] = typeof value === 'function' ? value(hooks.states[index]) : value;
      }];
    },
    useRef: (initial: object) => {
      const index = hooks.refIndex++;
      hooks.refs[index] ??= { current: initial };
      return hooks.refs[index];
    },
  };
});
vi.mock('react-dom', () => ({ createPortal: (children: unknown) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../src/i18n/useLocale', () => ({ useLocale: () => 'de' }));

const handoff: KalkulatorHandoff = {
  kind: 'gewerke', kindLabel: 'Test calculation', area: 10, picks: [],
  totalMin: 100, totalMax: 100, totalMid: 100, perM2: 10,
};
const gtag = vi.fn();
const fetchMock = vi.fn();
let CalculatorPdfSender: typeof import('../../src/components/calculator-pdf/CalculatorPdfSender').default;

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function render() {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  return CalculatorPdfSender({ handoff }) as ReactElement;
}
function submit() {
  const form = nodes(render()).find((node) => node.type === 'form')!;
  return (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
}
function editInput(type: 'email' | 'checkbox', value: string | boolean) {
  const input = nodes(render()).find((node) => node.type === 'input' && node.props.type === type)!;
  (input.props.onChange as (event: { currentTarget: { value: string | boolean; checked: string | boolean } }) => void)({
    currentTarget: { value, checked: value },
  });
}
function successfulResponse() {
  return { ok: true, json: async () => ({ ok: true }) };
}
function leads() {
  return gtag.mock.calls.filter(([command, event]) => command === 'event' && event === 'generate_lead');
}

beforeEach(async () => {
  vi.resetModules();
  gtag.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(successfulResponse());
  hooks.states = [true, 'first@example.test', true, 'idle', ''];
  hooks.refs = [];
  vi.stubEnv('VITE_GOOGLE_ANALYTICS_ID', 'G-TEST123456');
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', {
    location: new URL('https://example.test/kalkulator'),
    localStorage: { getItem: () => JSON.stringify({ choice: 'all', analytics: true }) },
    gtag,
  });
  vi.stubGlobal('document', {
    body: {}, getElementById: () => null, createElement: () => ({}), head: { append() {} },
  });
  CalculatorPdfSender = (await import('../../src/components/calculator-pdf/CalculatorPdfSender')).default;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('calculator enquiry flow tokens', () => {
  it('counts a new successful enquiry after editing a completed form', async () => {
    await submit();
    const firstToken = hooks.refs[0].current;
    expect(leads()).toHaveLength(1);
    editInput('email', 'second@example.test');
    expect(hooks.refs[0].current).not.toBe(firstToken);
    await submit();
    expect(leads()).toHaveLength(2);
  });

  it('keeps unchanged successful resends on one token', async () => {
    await submit();
    const token = hooks.refs[0].current;
    await submit();
    expect(hooks.refs[0].current).toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(leads()).toHaveLength(1);
  });

  it('allows a failed request retry without rotating or prematurely consuming its token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    await submit();
    const token = hooks.refs[0].current;
    expect(leads()).toHaveLength(0);
    await submit();
    expect(hooks.refs[0].current).toBe(token);
    expect(leads()).toHaveLength(1);
  });

  it('does not let an in-flight acknowledgement consume the token of edited input', async () => {
    let finish!: (response: ReturnType<typeof successfulResponse>) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = submit();
    const originalToken = hooks.refs[0].current;
    editInput('email', 'second@example.test');
    const nextToken = hooks.refs[0].current;
    expect(nextToken).not.toBe(originalToken);
    finish(successfulResponse());
    await pending;
    expect(leads()).toHaveLength(1);
    await submit();
    expect(hooks.refs[0].current).toBe(nextToken);
    expect(leads()).toHaveLength(2);
  });

  it('permits a reset form after re-confirming its checkbox without counting invalid submits', async () => {
    await submit();
    editInput('checkbox', false);
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    editInput('checkbox', true);
    await submit();
    expect(leads()).toHaveLength(2);
  });
});

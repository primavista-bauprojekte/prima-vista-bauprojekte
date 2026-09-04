import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const pollutionKey = 'netlifyTomlPollutionProbe';
const cargoManifest = `
[package]
name = "netlify-function"
version = "0.1.0"
edition = "2021"

[dependencies]
lambda_runtime = "0.8"
tokio = { version = "1", features = ["macros"] }
`;

describe.each(['netlify-cli', '@netlify/zip-it-and-ship-it'])('%s TOML parser', (consumer) => {
  // Resolve through the consumer to cover nested copies as well as a hoisted parser.
  const consumerRequire = createRequire(require.resolve(`${consumer}/package.json`));
  const toml = consumerRequire('toml') as { parse(input: string): Record<string, unknown> };

  it('preserves the Cargo manifest fields used to locate a Rust function binary', () => {
    expect(toml.parse(cargoManifest)).toMatchObject({
      package: { name: 'netlify-function', version: '0.1.0', edition: '2021' },
      dependencies: { lambda_runtime: '0.8', tokio: { version: '1', features: ['macros'] } },
    });
  });

  it('parses the existing Netlify configuration', () => {
    const source = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    expect(toml.parse(source)).toMatchObject({
      build: { command: 'npm run build', publish: 'dist', environment: { NODE_VERSION: '22' } },
      functions: { directory: 'netlify/functions', node_bundler: 'esbuild' },
    });
  });

  it('retains parse errors for invalid manifests', () => {
    expect(() => toml.parse('[package\nname = "broken"')).toThrow();
  });

  it.each([
    ['arrays', `value=${'['.repeat(3000)}1${']'.repeat(3000)}`],
    ['inline tables', `value=${'{item='.repeat(3000)}1${'}'.repeat(3000)}`],
  ])('rejects deeply nested %s without overflowing the stack', (_name, source) => {
    let parseError: unknown;
    try {
      toml.parse(source);
    } catch (error) {
      parseError = error;
    }

    expect(parseError).not.toBeInstanceOf(RangeError);
    expect(parseError).toMatchObject({
      message: expect.stringMatching(/maximum nesting depth/i),
      line: 1,
      column: expect.any(Number),
    });
  });

  it.each([
    ['scalar traversal', `[a.b]\ny = 1\n[a.b.y.__proto__.__proto__]\n${pollutionKey} = "unsafe"`],
    ['table-array prefix clearing', `aa = 1\n[[a]]\n[aa.__proto__.__proto__]\n${pollutionKey} = "unsafe"`],
  ])('rejects prototype pollution through %s', (_name, source) => {
    try {
      expect(() => toml.parse(source)).toThrow();
      expect(Object.hasOwn(Object.prototype, pollutionKey)).toBe(false);
    } finally {
      // Keep a vulnerable-parser regression from contaminating other tests.
      Reflect.deleteProperty(Object.prototype, pollutionKey);
    }
  });
});

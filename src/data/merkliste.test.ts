import { describe, expect, it } from 'vitest';
import { MERKLISTE_LIMIT, parseSaved, toggleSaved, type SavedPage } from './merkliste';

describe('merkliste', () => {
  it('adds and removes a page', () => {
    const entry = { catalogue: 'boden', page: 28, to: 29 };
    const added = toggleSaved([], entry);
    expect(added).toEqual([entry]);
    expect(toggleSaved(added, entry)).toEqual([]);
  });

  it('stops at the limit', () => {
    const full: SavedPage[] = Array.from({ length: MERKLISTE_LIMIT }, (_, i) => ({ catalogue: 'boden', page: i + 1 }));
    expect(toggleSaved(full, { catalogue: 'bad', page: 1 })).toBe(full);
  });

  it('round-trips valid entries and drops invalid ones', () => {
    const valid = { catalogue: 'bad', page: 5, thumb: 'data:image/jpeg;base64,AA==' };
    const stored = [valid, valid, null, 4, { catalogue: 'gone', page: 1 }, { catalogue: 'bad', page: 900 }, { catalogue: 'bad', page: '5' }];
    expect(parseSaved(JSON.stringify(stored))).toEqual([valid]);
    expect(parseSaved(JSON.stringify([{ catalogue: 'bad', page: 6, to: 80, thumb: 'https://x.test/a.png' }]))).toEqual([{ catalogue: 'bad', page: 6 }]);
  });

  it.each([null, '', '{', '{}', '"x"'])('tolerates %j', (raw) => {
    expect(parseSaved(raw)).toEqual([]);
  });
});

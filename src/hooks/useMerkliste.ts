import { useCallback, useState } from 'react';
import { parseSaved, toggleSaved, type SavedPage } from '../data/merkliste';

const STORAGE_KEY = 'pv-merkliste';

function read(): SavedPage[] {
  try {
    return parseSaved(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function write(list: SavedPage[]) {
  try {
    if (list.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Blocked or full storage: the list still works until the page is left.
  }
}

export function useMerkliste() {
  const [list, setList] = useState(read);

  const update = useCallback((next: SavedPage[]) => {
    write(next);
    setList(next);
  }, []);
  const toggle = useCallback((entry: SavedPage) => update(toggleSaved(list, entry)), [list, update]);
  const clear = useCallback(() => update([]), [update]);

  return { list, toggle, clear };
}

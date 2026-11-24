import { MATERIAL_CATALOGUES } from './materialien';

/** A catalogue page (or double page) a visitor saved. Stays in their browser. */
export type SavedPage = {
  catalogue: string;
  page: number;
  /** Second page of a spread. */
  to?: number;
  /** Small JPEG data URL. */
  thumb?: string;
};

export const MERKLISTE_LIMIT = 24;
const THUMB_PREFIX = 'data:image/jpeg;base64,';

export const savedLabel = ({ page, to }: SavedPage) => (to ? `${page}–${to}` : String(page));

export const isSaved = (list: SavedPage[], catalogue: string, page: number) =>
  list.some((entry) => entry.catalogue === catalogue && entry.page === page);

export function toggleSaved(list: SavedPage[], entry: SavedPage): SavedPage[] {
  if (isSaved(list, entry.catalogue, entry.page)) {
    return list.filter((item) => !(item.catalogue === entry.catalogue && item.page === entry.page));
  }
  return list.length >= MERKLISTE_LIMIT ? list : [...list, entry];
}

/** Stored data is untrusted: drop anything that no longer matches a catalogue. */
export function parseSaved(raw: string | null): SavedPage[] {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const result: SavedPage[] = [];
  for (const item of value as Array<Partial<SavedPage> | null>) {
    const catalogue = MATERIAL_CATALOGUES.find((entry) => entry.key === item?.catalogue);
    if (!item || !catalogue) continue;
    const { page, to, thumb } = item;
    if (!Number.isInteger(page) || page! < 1 || page! > catalogue.pages) continue;
    if (isSaved(result, catalogue.key, page!) || result.length >= MERKLISTE_LIMIT) continue;
    result.push({
      catalogue: catalogue.key,
      page: page!,
      ...(to === page! + 1 && to <= catalogue.pages ? { to } : {}),
      ...(typeof thumb === 'string' && thumb.startsWith(THUMB_PREFIX) ? { thumb } : {}),
    });
  }
  return result;
}

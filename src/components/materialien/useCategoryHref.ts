import { useLocation } from 'react-router';

/** Link target that keeps the current localized page and only swaps the hash. */
export function useCategoryHref() {
  const { pathname, search } = useLocation();
  return (hash: string) => ({ pathname, search, hash });
}

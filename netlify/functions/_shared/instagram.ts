import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { sanitizePlainText } from './content';
import { getEnv } from './env';

/**
 * Instagram feed integration.
 *
 * The Basic Display API was shut down in December 2024; the supported path for
 * reading an own professional account is the Instagram API with Instagram
 * Login on graph.instagram.com. It issues long-lived tokens that expire after
 * 60 days, so the token is treated as rotating state rather than a static
 * secret: INSTAGRAM_ACCESS_TOKEN only seeds the chain, and every refresh is
 * persisted back to the blob store.
 *
 * Nothing here throws on a missing configuration — an unconfigured site simply
 * reports `configured: false` and the homepage section hides itself, matching
 * how the Google reviews and Google Calendar integrations degrade.
 */

const GRAPH_ORIGIN = 'https://graph.instagram.com';
const DEFAULT_API_VERSION = 'v26.0';

const STORE_NAME = 'pv-instagram';
const TOKEN_KEY = 'token';
const FEED_KEY = 'feed';
const USER_ID_KEY = 'user-id';
const IMAGE_PREFIX = 'image-';

const UPSTREAM_TIMEOUT_MS = 8_000;
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;
/** Instagram rejects a refresh while the token is younger than 24 hours. */
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
/** Read-path safety net: only refresh inline once the scheduler has clearly stopped running. */
const STALE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

const FEED_TTL_MS = 30 * 60 * 1000;
/** Keep serving the last good feed this long when Instagram is unreachable. */
const FEED_STALE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_POST_LIMIT = 12;
const MAX_POST_LIMIT = 24;
const MAX_CAPTION_CHARS = 220;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const DEFAULT_USERNAME = 'primavista.bauprojekte';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

/** A post as sent to the browser. The Instagram CDN URL is deliberately absent. */
export type InstagramPost = {
  id: string;
  caption: string;
  altText: string;
  permalink: string;
  mediaType: InstagramMediaType;
  imageUrl: string;
  timestamp: string;
};

export type InstagramFeedResponse = {
  configured: boolean;
  username: string;
  profileUrl: string;
  posts: InstagramPost[];
};

type CachedPost = InstagramPost & {
  /** Signed CDN URL. Server-side only: these expire and must never be cached in a browser. */
  sourceUrl: string;
};

type CachedFeed = {
  username: string;
  posts: CachedPost[];
  fetchedAt: number;
};

type TokenState = {
  accessToken: string;
  expiresAt: number;
  refreshedAt: number;
  /** Fingerprint of the env var that seeded this chain, so a re-pasted token takes over. */
  seedFingerprint: string;
};

// ─────────────────────────── storage ───────────────────────────

declare global {
  var __pvInstagramStore: Map<string, unknown> | undefined;
}

/**
 * Netlify Blobs is only available inside the Netlify runtime. Plain `vite dev`
 * and unit tests fall back to a process-local map so the feed still renders —
 * it just loses its cache on restart.
 */
function memoryStore() {
  return (globalThis.__pvInstagramStore ??= new Map<string, unknown>());
}

let blobStore: ReturnType<typeof getStore> | null | undefined;

function blobs() {
  if (blobStore !== undefined) return blobStore;
  try {
    blobStore = getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch {
    blobStore = null;
  }
  return blobStore;
}

/** Log without ever echoing a URL or payload that could carry the access token. */
function logFailure(tag: string, detail: string) {
  console.error(`[instagram:${tag}] ${detail}`);
}

async function readJson<T>(key: string): Promise<T | null> {
  const store = blobs();
  if (store) {
    try {
      const value = (await store.get(key, { type: 'json' })) as T | null;
      if (value) return value;
    } catch {
      logFailure('blob-read', `could not read ${key}`);
    }
  }
  return (memoryStore().get(key) as T | undefined) ?? null;
}

async function writeJson(key: string, value: unknown): Promise<void> {
  memoryStore().set(key, value);
  const store = blobs();
  if (!store) return;
  try {
    await store.setJSON(key, value);
  } catch {
    logFailure('blob-write', `could not persist ${key}`);
  }
}

// ─────────────────────────── configuration ───────────────────────────

function apiVersion() {
  const configured = getEnv('INSTAGRAM_API_VERSION')?.trim();
  // An operator typo must not build a garbage upstream URL.
  return configured && /^v\d{1,2}\.\d{1,2}$/.test(configured) ? configured : DEFAULT_API_VERSION;
}

function postLimit() {
  const raw = Number(getEnv('INSTAGRAM_POST_LIMIT'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_POST_LIMIT;
  return Math.min(Math.floor(raw), MAX_POST_LIMIT);
}

function profileUrlFor(username: string) {
  return `https://www.instagram.com/${username}`;
}

function fingerprint(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function isConfigured() {
  return Boolean(getEnv('INSTAGRAM_ACCESS_TOKEN')?.trim());
}

// ─────────────────────────── token lifecycle ───────────────────────────

async function loadToken(): Promise<TokenState | null> {
  const envToken = getEnv('INSTAGRAM_ACCESS_TOKEN')?.trim();
  const stored = await readJson<TokenState>(TOKEN_KEY);

  if (!envToken) return stored;

  const seedFingerprint = fingerprint(envToken);
  if (stored?.seedFingerprint === seedFingerprint) return stored;

  // Either nothing is stored yet, or the operator pasted a new token — which is
  // how a lapsed chain gets recovered. Assume it was just minted; the first
  // refresh replaces the guessed expiry with the real one.
  const now = Date.now();
  const seeded: TokenState = {
    accessToken: envToken,
    expiresAt: now + TOKEN_LIFETIME_MS,
    refreshedAt: now,
    seedFingerprint,
  };
  await writeJson(TOKEN_KEY, seeded);
  return seeded;
}

export type RefreshOutcome = {
  ok: boolean;
  reason: 'refreshed' | 'not-configured' | 'too-young' | 'upstream-error';
  expiresAt?: number;
};

/**
 * Exchange the current long-lived token for a fresh 60-day one.
 *
 * Refreshing is idempotent and safe to run daily: Instagram issues a new
 * 60-day token on every call, so a token refreshed each day is never close to
 * expiring. The only hard rule is that it must be at least 24 hours old.
 */
export async function refreshAccessToken(): Promise<RefreshOutcome> {
  const token = await loadToken();
  if (!token) return { ok: false, reason: 'not-configured' };

  if (Date.now() - token.refreshedAt < MIN_TOKEN_AGE_MS) {
    return { ok: false, reason: 'too-young', expiresAt: token.expiresAt };
  }

  const url = new URL(`${GRAPH_ORIGIN}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token.accessToken);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!response.ok) {
      // Never log the body: an error payload can echo the token back.
      logFailure('token-refresh', `HTTP ${response.status}`);
      return { ok: false, reason: 'upstream-error' };
    }

    const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
    if (!accessToken) {
      logFailure('token-refresh', 'response contained no access_token');
      return { ok: false, reason: 'upstream-error' };
    }

    const expiresInSeconds = Number(payload.expires_in);
    const lifetime = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : TOKEN_LIFETIME_MS;
    const now = Date.now();
    const next: TokenState = {
      accessToken,
      expiresAt: now + lifetime,
      refreshedAt: now,
      seedFingerprint: token.seedFingerprint,
    };
    await writeJson(TOKEN_KEY, next);
    return { ok: true, reason: 'refreshed', expiresAt: next.expiresAt };
  } catch {
    logFailure('token-refresh', 'request failed or timed out');
    return { ok: false, reason: 'upstream-error' };
  }
}

// ─────────────────────────── feed ───────────────────────────

type RawChild = {
  media_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
};

type RawMedia = {
  id?: unknown;
  caption?: unknown;
  alt_text?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  permalink?: unknown;
  thumbnail_url?: unknown;
  timestamp?: unknown;
  children?: unknown;
};

function asMediaType(value: unknown): InstagramMediaType | null {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'CAROUSEL_ALBUM' ? value : null;
}

/**
 * Only accept absolute https URLs on Instagram's own hosts.
 *
 * Fail-closed allowlist, in the spirit of normalizeCoverImageUrl: embedded
 * credentials and explicit ports are rejected too, so a hostile payload cannot
 * smuggle the server into fetching somewhere else.
 */
export function sanitizeInstagramUrl(value: unknown, allowedHostSuffixes: readonly string[]): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (url.username || url.password || url.port) return '';
    const host = url.hostname.toLowerCase();
    return allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

const asInstagramUrl = sanitizeInstagramUrl;

export const CDN_HOSTS = ['cdninstagram.com', 'fbcdn.net'] as const;
export const PERMALINK_HOSTS = ['instagram.com'] as const;
export const MEDIA_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Project a cached post down to what the browser may see.
 *
 * Deliberately an explicit allowlist rather than a rest-spread: a field added
 * to the cached shape later must not silently start reaching the client.
 */
function toPublicPost(post: CachedPost): InstagramPost {
  return {
    id: post.id,
    caption: post.caption,
    altText: post.altText,
    permalink: post.permalink,
    mediaType: post.mediaType,
    imageUrl: post.imageUrl,
    timestamp: post.timestamp,
  };
}

/**
 * Pick the still image for one media node.
 *
 * `thumbnail_url` exists only on VIDEO media, and a CAROUSEL_ALBUM carries no
 * `media_url` of its own — its slides live under `children` — so each type has
 * to be resolved separately rather than reading one common field.
 */
function stillFor(mediaType: InstagramMediaType | null, node: RawMedia | RawChild): string {
  if (mediaType === 'VIDEO') {
    return asInstagramUrl(node.thumbnail_url, CDN_HOSTS) || asInstagramUrl(node.media_url, CDN_HOSTS);
  }
  return asInstagramUrl(node.media_url, CDN_HOSTS);
}

function firstChildStill(raw: RawMedia): string {
  const container = raw.children as { data?: unknown } | undefined;
  const children = Array.isArray(container?.data) ? (container.data as RawChild[]) : [];
  for (const child of children) {
    const still = stillFor(asMediaType(child.media_type), child);
    if (still) return still;
  }
  return '';
}

function normalize(raw: RawMedia): CachedPost | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const mediaType = asMediaType(raw.media_type);
  const permalink = asInstagramUrl(raw.permalink, PERMALINK_HOSTS);
  if (!id || !MEDIA_ID_RE.test(id) || !mediaType || !permalink) return null;

  // Albums are documented as having no media_url; fall back to the first slide.
  // The direct field is still tried first because the API often does populate it.
  const sourceUrl = stillFor(mediaType, raw)
    || (mediaType === 'CAROUSEL_ALBUM' ? firstChildStill(raw) : '');
  if (!sourceUrl) return null;

  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : '';

  return {
    id,
    caption: typeof raw.caption === 'string' ? sanitizePlainText(raw.caption, MAX_CAPTION_CHARS) : '',
    altText: typeof raw.alt_text === 'string' ? sanitizePlainText(raw.alt_text, MAX_CAPTION_CHARS) : '',
    permalink,
    mediaType,
    imageUrl: `/api/instagram/image/${encodeURIComponent(id)}`,
    timestamp,
    sourceUrl,
  };
}

async function fetchGraph(path: string, accessToken: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_ORIGIN}/${apiVersion()}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

const MEDIA_FIELDS = [
  'id',
  'caption',
  'alt_text',
  'media_type',
  'media_url',
  'permalink',
  'thumbnail_url',
  'timestamp',
  'children{id,media_type,media_url,thumbnail_url}',
].join(',');

/**
 * Read the media edge.
 *
 * Meta's reference documents the edge as `/<ig-user-id>/media`; `/me/media`
 * resolves to the same node and saves a round trip, so it is tried first and
 * the explicit id is only resolved if that fails.
 */
async function fetchMediaEdge(accessToken: string) {
  const params = { fields: MEDIA_FIELDS, limit: String(postLimit()) };

  try {
    return await fetchGraph('me/media', accessToken, params);
  } catch (err) {
    logFailure('media', `me/media failed (${err instanceof Error ? err.message : 'unknown'}), retrying via user id`);
  }

  let userId = await readJson<string>(USER_ID_KEY);
  if (!userId) {
    const profile = await fetchGraph('me', accessToken, { fields: 'user_id' });
    userId = typeof profile.user_id === 'string' ? profile.user_id : '';
    if (!userId) throw new Error('could not resolve Instagram user id');
    await writeJson(USER_ID_KEY, userId);
  }

  return fetchGraph(`${encodeURIComponent(userId)}/media`, accessToken, params);
}

async function fetchFeed(): Promise<CachedFeed | null> {
  const token = await loadToken();
  if (!token) return null;

  // The scheduled refresh normally keeps the token young. This only fires when
  // the schedule has not run for a week, so the read path stays cheap.
  if (Date.now() - token.refreshedAt >= STALE_TOKEN_MS) {
    await refreshAccessToken();
  }

  const current = (await loadToken()) ?? token;

  try {
    const media = await fetchMediaEdge(current.accessToken);

    const entries = Array.isArray(media.data) ? (media.data as RawMedia[]) : [];
    const posts = entries
      .map(normalize)
      .filter((post): post is CachedPost => post !== null)
      .slice(0, postLimit());

    let username = getEnv('INSTAGRAM_USERNAME')?.trim() || '';
    if (!username) {
      try {
        const profile = await fetchGraph('me', current.accessToken, { fields: 'username' });
        username = typeof profile.username === 'string' ? profile.username : '';
      } catch {
        logFailure('profile', 'username lookup failed');
      }
    }

    return { username: username || DEFAULT_USERNAME, posts, fetchedAt: Date.now() };
  } catch (err) {
    logFailure('media', err instanceof Error ? err.message : 'request failed');
    return null;
  }
}

async function loadFeed(forceRefresh = false): Promise<CachedFeed | null> {
  const cached = await readJson<CachedFeed>(FEED_KEY);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (!forceRefresh && cached && age < FEED_TTL_MS) return cached;

  const fresh = await fetchFeed();
  if (fresh) {
    await writeJson(FEED_KEY, fresh);
    return fresh;
  }

  // Upstream failed. A stale feed still renders correctly because the browser
  // only ever sees our own proxy URLs, so keep serving it for a while.
  if (cached && age < FEED_STALE_GRACE_MS) return cached;
  return null;
}

/** Public payload for GET /api/instagram. */
export async function getFeedResponse(): Promise<InstagramFeedResponse> {
  const username = getEnv('INSTAGRAM_USERNAME')?.trim() || DEFAULT_USERNAME;

  if (!isConfigured()) {
    return { configured: false, username, profileUrl: profileUrlFor(username), posts: [] };
  }

  const feed = await loadFeed();
  if (!feed) {
    return { configured: true, username, profileUrl: profileUrlFor(username), posts: [] };
  }

  return {
    configured: true,
    username: feed.username,
    profileUrl: profileUrlFor(feed.username),
    posts: feed.posts.map(toPublicPost),
  };
}

/** Warm the cache from the scheduled job so visitors never pay for the upstream call. */
export async function warmFeed() {
  return loadFeed(true);
}

// ─────────────────────────── image mirror ───────────────────────────

type MirroredImage = { data: ArrayBuffer; contentType: string };

function imageKey(id: string) {
  return `${IMAGE_PREFIX}${id}`;
}

async function readMirroredImage(id: string): Promise<MirroredImage | null> {
  const key = imageKey(id);
  const store = blobs();
  if (store) {
    try {
      const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (result?.data) {
        const contentType = typeof result.metadata?.contentType === 'string'
          ? result.metadata.contentType
          : 'image/jpeg';
        return { data: result.data as ArrayBuffer, contentType };
      }
    } catch {
      logFailure('image-read', 'blob lookup failed');
    }
  }
  return (memoryStore().get(key) as MirroredImage | undefined) ?? null;
}

async function writeMirroredImage(id: string, image: MirroredImage) {
  const key = imageKey(id);
  memoryStore().set(key, image);
  const store = blobs();
  if (!store) return;
  try {
    await store.set(key, image.data, { metadata: { contentType: image.contentType } });
  } catch {
    logFailure('image-write', 'blob write failed');
  }
}

async function downloadImage(sourceUrl: string): Promise<MirroredImage | null> {
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) return null;

    const data = await response.arrayBuffer();
    if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return null;

    return { data, contentType };
  } catch {
    return null;
  }
}

/**
 * Resolve one post's image, mirroring it into blob storage on first request.
 *
 * Instagram's CDN links are signed and expire, so they are never handed to the
 * browser. Mirroring also means an expired link only costs one re-fetch of the
 * feed rather than a broken image on the page.
 */
export async function getPostImage(id: string): Promise<MirroredImage | null> {
  if (!MEDIA_ID_RE.test(id)) return null;

  const mirrored = await readMirroredImage(id);
  if (mirrored) return mirrored;

  for (const forceRefresh of [false, true]) {
    const feed = await loadFeed(forceRefresh);
    const post = feed?.posts.find((entry) => entry.id === id);
    if (!post) continue;

    const image = await downloadImage(post.sourceUrl);
    if (image) {
      await writeMirroredImage(id, image);
      return image;
    }
  }

  return null;
}

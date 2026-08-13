import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CDN_HOSTS,
  getFeedResponse,
  getPostImage,
  isConfigured,
  MEDIA_ID_RE,
  refreshAccessToken,
  sanitizeInstagramUrl,
} from '../../netlify/functions/_shared/instagram';

const TOKEN = 'IGAA-seed-token';
const DAY_MS = 24 * 60 * 60 * 1000;

type GraphReply = {
  ok?: boolean;
  status?: number;
  json?: unknown;
  bytes?: Uint8Array;
  contentType?: string;
};

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function store() {
  return (globalThis.__pvInstagramStore ??= new Map<string, unknown>());
}

/** Pre-seed the persisted token so tests can control its age. */
function seedToken(ageMs = 0) {
  const now = Date.now();
  store().set('token', {
    accessToken: TOKEN,
    expiresAt: now + 60 * DAY_MS,
    refreshedAt: now - ageMs,
    seedFingerprint: fingerprint(TOKEN),
  });
}

function stubFetch(handler: (url: string) => GraphReply) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    const reply = handler(url);

    if (reply.bytes) {
      return new Response(reply.bytes, {
        status: reply.status ?? 200,
        headers: { 'content-type': reply.contentType ?? 'image/jpeg' },
      });
    }

    return new Response(JSON.stringify(reply.json ?? {}), {
      status: reply.status ?? (reply.ok === false ? 500 : 200),
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const IMAGE_POST = {
  id: '111',
  caption: 'Neues Bad in <b>Frankfurt</b>',
  alt_text: 'Fertig saniertes Badezimmer',
  media_type: 'IMAGE',
  media_url: 'https://scontent-fra3-1.cdninstagram.com/v/image-111.jpg?oe=abc',
  permalink: 'https://www.instagram.com/p/aaa/',
  timestamp: '2026-08-01T10:00:00+0000',
};

const VIDEO_POST = {
  id: '222',
  caption: 'Zeitraffer der Montage',
  media_type: 'VIDEO',
  media_url: 'https://scontent-fra3-1.cdninstagram.com/v/clip-222.mp4?oe=abc',
  thumbnail_url: 'https://scontent-fra3-1.cdninstagram.com/v/poster-222.jpg?oe=abc',
  permalink: 'https://www.instagram.com/reel/bbb/',
  timestamp: '2026-08-02T10:00:00+0000',
};

/** Albums are documented as carrying no media_url of their own. */
const ALBUM_POST = {
  id: '333',
  caption: 'Vorher / nachher',
  media_type: 'CAROUSEL_ALBUM',
  permalink: 'https://www.instagram.com/p/ccc/',
  timestamp: '2026-08-03T10:00:00+0000',
  children: {
    data: [
      { id: '333-1', media_type: 'IMAGE', media_url: 'https://scontent-fra3-1.cdninstagram.com/v/slide-1.jpg?oe=abc' },
      { id: '333-2', media_type: 'IMAGE', media_url: 'https://scontent-fra3-1.cdninstagram.com/v/slide-2.jpg?oe=abc' },
    ],
  },
};

function graphReply(url: string): GraphReply {
  if (url.includes('/me/media')) {
    return { json: { data: [IMAGE_POST, VIDEO_POST, ALBUM_POST] } };
  }
  if (url.includes('/me?') || url.includes('/me&')) {
    return { json: { username: 'primavista.bauprojekte' } };
  }
  return { json: {} };
}

describe('Instagram url and id allowlists', () => {
  it('follows media urls only on allowlisted https Instagram hosts', () => {
    expect(sanitizeInstagramUrl('https://scontent.cdninstagram.com/v/a.jpg', CDN_HOSTS))
      .toBe('https://scontent.cdninstagram.com/v/a.jpg');

    [
      'http://scontent.cdninstagram.com/v/a.jpg',
      'https://cdninstagram.com.evil.example/v/a.jpg',
      'https://evil.example/v/a.jpg',
      'https://user:pass@scontent.cdninstagram.com/v/a.jpg',
      'https://scontent.cdninstagram.com:8080/v/a.jpg',
      'file:///etc/passwd',
      'javascript:alert(1)',
      '',
      null,
    ].forEach((unsafeUrl) => expect(sanitizeInstagramUrl(unsafeUrl, CDN_HOSTS)).toBe(''));
  });

  it('accepts only plain media identifiers as image-proxy keys', () => {
    expect(MEDIA_ID_RE.test('17912345678901234')).toBe(true);

    ['../../secret', 'a/b', '', 'a'.repeat(65), 'id with space', 'a.b'].forEach((badId) => {
      expect(MEDIA_ID_RE.test(badId)).toBe(false);
    });
  });
});

describe('Instagram feed integration', () => {
  beforeEach(() => {
    store().clear();
    delete process.env.INSTAGRAM_USERNAME;
    delete process.env.INSTAGRAM_POST_LIMIT;
    process.env.INSTAGRAM_ACCESS_TOKEN = TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
  });

  it('stays dormant and makes no upstream call when no token is configured', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const fetchMock = stubFetch(graphReply);

    expect(isConfigured()).toBe(false);
    const feed = await getFeedResponse();

    expect(feed.configured).toBe(false);
    expect(feed.posts).toEqual([]);
    expect(feed.profileUrl).toBe('https://www.instagram.com/primavista.bauprojekte');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes images, videos and albums without leaking the CDN url', async () => {
    stubFetch(graphReply);

    const feed = await getFeedResponse();

    expect(feed.configured).toBe(true);
    expect(feed.posts.map((post) => post.id)).toEqual(['111', '222', '333']);

    // Every image is served through our own proxy, never the signed CDN link.
    for (const post of feed.posts) {
      expect(post.imageUrl).toBe(`/api/instagram/image/${post.id}`);
      expect(JSON.stringify(post)).not.toContain('cdninstagram.com');
    }

    expect(feed.posts[0].caption).toBe('Neues Bad in Frankfurt');
    expect(feed.posts[0].altText).toBe('Fertig saniertes Badezimmer');
    expect(feed.posts[1].mediaType).toBe('VIDEO');
    expect(feed.posts[2].mediaType).toBe('CAROUSEL_ALBUM');
  });

  it('falls back to the first slide for an album that has no media_url', async () => {
    stubFetch(graphReply);
    await getFeedResponse();

    const cached = store().get('feed') as { posts: { id: string; sourceUrl: string }[] };
    const album = cached.posts.find((post) => post.id === '333');

    expect(album?.sourceUrl).toBe('https://scontent-fra3-1.cdninstagram.com/v/slide-1.jpg?oe=abc');
  });

  it('drops media whose urls are not https on an Instagram host', async () => {
    stubFetch((url) => {
      if (url.includes('/me/media')) {
        return {
          json: {
            data: [
              { ...IMAGE_POST, id: '901', media_url: 'https://evil.example.com/pwn.jpg' },
              { ...IMAGE_POST, id: '902', permalink: 'https://evil.example.com/p/x/' },
              { ...IMAGE_POST, id: '903', media_url: 'http://scontent.cdninstagram.com/v/x.jpg' },
              IMAGE_POST,
            ],
          },
        };
      }
      return graphReply(url);
    });

    const feed = await getFeedResponse();

    expect(feed.posts.map((post) => post.id)).toEqual(['111']);
  });

  it('keeps serving the last good feed when Instagram is unreachable', async () => {
    stubFetch(graphReply);
    await getFeedResponse();

    // Age the cache past its TTL so the next read attempts a refresh.
    const cached = store().get('feed') as { fetchedAt: number };
    cached.fetchedAt = Date.now() - 60 * 60 * 1000;

    stubFetch(() => ({ ok: false, status: 500 }));
    const feed = await getFeedResponse();

    expect(feed.configured).toBe(true);
    expect(feed.posts).toHaveLength(3);
  });

  it('reports an empty feed rather than failing when nothing was ever cached', async () => {
    stubFetch(() => ({ ok: false, status: 500 }));

    const feed = await getFeedResponse();

    expect(feed.configured).toBe(true);
    expect(feed.posts).toEqual([]);
  });

  it('refuses to refresh a token younger than 24 hours', async () => {
    seedToken(0);
    const fetchMock = stubFetch(graphReply);

    const outcome = await refreshAccessToken();

    expect(outcome).toMatchObject({ ok: false, reason: 'too-young' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an older token and persists the replacement', async () => {
    seedToken(2 * DAY_MS);
    const fetchMock = stubFetch((url) => {
      expect(url).toContain('grant_type=ig_refresh_token');
      return { json: { access_token: 'IGAA-rotated', token_type: 'bearer', expires_in: 5_183_944 } };
    });

    const outcome = await refreshAccessToken();

    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const stored = store().get('token') as { accessToken: string; seedFingerprint: string };
    expect(stored.accessToken).toBe('IGAA-rotated');
    // The chain still remembers which env value seeded it.
    expect(stored.seedFingerprint).toBe(fingerprint(TOKEN));
  });

  it('lets a newly pasted env token take over a stored chain', async () => {
    seedToken(2 * DAY_MS);
    process.env.INSTAGRAM_ACCESS_TOKEN = 'IGAA-operator-replacement';
    stubFetch(graphReply);

    await getFeedResponse();

    const stored = store().get('token') as { accessToken: string };
    expect(stored.accessToken).toBe('IGAA-operator-replacement');
  });

  it('rejects image ids that are not plain media identifiers', async () => {
    stubFetch(graphReply);

    expect(await getPostImage('../../secret')).toBeNull();
    expect(await getPostImage('a'.repeat(65))).toBeNull();
  });

  it('mirrors a post image and refuses non-image responses', async () => {
    stubFetch((url) => {
      if (url.includes('image-111.jpg')) {
        return { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'image/jpeg' };
      }
      if (url.includes('poster-222.jpg')) {
        return { bytes: new Uint8Array([9]), contentType: 'text/html' };
      }
      return graphReply(url);
    });

    const image = await getPostImage('111');
    expect(image?.contentType).toBe('image/jpeg');
    expect(new Uint8Array(image!.data)).toEqual(new Uint8Array([1, 2, 3, 4]));

    expect(await getPostImage('222')).toBeNull();
  });

  it('honours the configured post limit', async () => {
    process.env.INSTAGRAM_POST_LIMIT = '2';
    stubFetch(graphReply);

    const feed = await getFeedResponse();

    expect(feed.posts).toHaveLength(2);
  });
});

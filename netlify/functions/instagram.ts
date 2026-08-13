import type { Config, Context } from '@netlify/functions';
import { getFeedResponse, getPostImage } from './_shared/instagram';
import { errorResponse, json, methodNotAllowed } from './_shared/http';

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
}

async function readFeed() {
  const feed = await getFeedResponse();

  const headers: Record<string, string> = {};
  if (isProduction()) {
    // The blob cache already absorbs the upstream calls; this only keeps a
    // browser from re-asking on every navigation. Kept short so a new post
    // shows up promptly.
    headers['cache-control'] = feed.posts.length
      ? 'public, max-age=300'
      : 'public, max-age=60';
  }

  return json(feed, { headers });
}

async function readImage(id: string) {
  const image = await getPostImage(id);
  if (!image) return json({ error: 'Image not found' }, { status: 404 });

  return new Response(image.data, {
    headers: {
      // Mirrored bytes are addressed by immutable media id, so they can be
      // cached hard — unlike the signed Instagram CDN URL behind them.
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': image.contentType,
    },
  });
}

export default async (req: Request, context: Context) => {
  const id = context.params.id;

  try {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    return id ? readImage(id) : readFeed();
  } catch (err) {
    return errorResponse(err, 'instagram');
  }
};

export const config: Config = {
  path: ['/api/instagram', '/api/instagram/image/:id'],
};

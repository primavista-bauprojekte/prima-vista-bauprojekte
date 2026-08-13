import type { Config } from '@netlify/functions';
import { isConfigured, refreshAccessToken, warmFeed } from './_shared/instagram';

/**
 * Daily upkeep for the Instagram integration.
 *
 * Instagram long-lived tokens expire 60 days after they are issued, and a
 * lapsed token can only be replaced by hand. Refreshing daily keeps the live
 * token roughly one day old at all times, so the 60-day deadline is never
 * approached — a missed run (or a week of them) costs nothing.
 *
 * The same run re-fetches the feed so visitors never pay for the upstream call
 * and a new Instagram post appears within a day even if nobody browses the
 * homepage in between.
 */
export default async () => {
  if (!isConfigured()) {
    console.log('[instagram-refresh] skipped — INSTAGRAM_ACCESS_TOKEN is not set');
    return new Response(null, { status: 204 });
  }

  const refresh = await refreshAccessToken();
  console.log(`[instagram-refresh] token: ${refresh.reason}`);

  const feed = await warmFeed();
  console.log(`[instagram-refresh] feed: ${feed ? `${feed.posts.length} posts` : 'unavailable'}`);

  return new Response(null, { status: 204 });
};

export const config: Config = {
  schedule: '@daily',
};

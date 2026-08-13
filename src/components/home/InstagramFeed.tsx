import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { InstagramIcon } from '../icons';

type InstagramPost = {
  id: string;
  caption: string;
  altText: string;
  permalink: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  imageUrl: string;
  timestamp: string;
};

type InstagramFeedPayload = {
  configured: boolean;
  username: string;
  profileUrl: string;
  posts: InstagramPost[];
};

const RICH = { em: <em />, br: <br /> } as const;

export default function InstagramFeed() {
  const { t } = useTranslation('home');
  const [feed, setFeed] = useState<InstagramFeedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/instagram')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((payload: InstagramFeedPayload) => {
        if (!cancelled) setFeed(payload);
      })
      .catch(() => {
        if (!cancelled) setFeed(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Until Instagram is connected — and whenever it has nothing to show — the
  // section stays out of the page entirely rather than rendering an empty band.
  if (!feed?.configured || feed.posts.length === 0) return null;

  return (
    <section className="instagram">
      <div className="instagram__inner">
        <div className="instagram__head">
          <div className="reveal">
            <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('instagram.eyebrow')}</div>
            <h2>
              <Trans i18nKey="home:instagram.title" components={RICH} />
            </h2>
          </div>
          <div className="instagram__aside reveal" data-delay="1">
            <p>{t('instagram.intro')}</p>
            <a
              className="btn btn--light instagram__follow"
              href={feed.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon />
              <span>@{feed.username}</span>
              <span className="arrow">&gt;</span>
            </a>
          </div>
        </div>

        <ul className="instagram__grid reveal-group">
          {feed.posts.map((post) => (
            <li className="instagram__item" key={post.id}>
              <a
                className="ig-card"
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={post.caption || t('instagram.viewPost')}
              >
                <img
                  className="ig-card__img"
                  src={post.imageUrl}
                  alt={post.altText || post.caption || t('instagram.imageAlt')}
                  width="640"
                  height="640"
                  loading="lazy"
                />
                {post.mediaType !== 'IMAGE' && (
                  <span
                    className="ig-card__badge"
                    aria-label={post.mediaType === 'VIDEO' ? t('instagram.badgeVideo') : t('instagram.badgeAlbum')}
                  >
                    {post.mediaType === 'VIDEO' ? '▶' : '❐'}
                  </span>
                )}
                {post.caption && (
                  <span className="ig-card__caption">
                    <span>{post.caption}</span>
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { Trans, useTranslation } from 'react-i18next';
import { Link } from '../i18n/Link';
import Counter from '../components/Counter';
import FeaturedProjects from '../components/home/FeaturedProjects';
import GoogleReviews from '../components/home/GoogleReviews';
import HomeAboutVideo from '../components/home/HomeAboutVideo';
import HomeHero from '../components/home/HomeHero';
import HomeHeroPhotos from '../components/home/HomeHeroPhotos';
import HomeMarquee from '../components/home/HomeMarquee';
import HomeKalkulatorLive from '../components/home/HomeKalkulatorLive';
import HomeBlitzLive from '../components/home/HomeBlitzLive';
import InstagramFeed from '../components/home/InstagramFeed';
import { TRADES_PREVIEW } from '../data/home';
import { PREVIEW_IMAGES } from '../data/gewerke';
import '../styles/pages/home.css';

// Inline-markup map for stylized headings (line breaks + emphasis).
const RICH = { em: <em />, br: <br /> } as const;
const PROMISE_STEP_KEYS = ['1', '2', '3', '4', '5', '6'] as const;

export default function Home() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <>
      <HomeHero />
      <HomeMarquee />

      {/* PACKAGES */}
      <section className="packages">
        <div className="packages__head">
          <div className="reveal">
            <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('packages.eyebrow')}</div>
            <h2>
              <Trans i18nKey="home:packages.title" components={RICH} />
            </h2>
          </div>
          <div className="packages__intro reveal" data-delay="1">
            <p>{t('packages.intro')}</p>
            <Link className="btn btn--appointment btn--shimmer packages__appointment" to="/kontakt">
              {t('finalCta.appointment')} <span className="arrow">&gt;</span>
            </Link>
          </div>
        </div>
        <div className="packages__grid">
          <Link className="pkg-card reveal" data-delay="1" to="/haus-sanierung">
            <img src="/assets/img/photo-haus-exterior.webp" alt={t('packages.items.haus.alt')} width="1500" height="682" loading="lazy" />
            <div className="pkg-card__body">
              <span className="pkg-card__num">{t('packages.items.haus.num')}</span>
              <h3 className="pkg-card__title"><Trans i18nKey="home:packages.items.haus.title" components={RICH} /></h3>
              <p className="pkg-card__desc">{t('packages.items.haus.desc')}</p>
              <span className="pkg-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
          <Link className="pkg-card reveal" data-delay="2" to="/wohnung-sanierung">
            <img src="/assets/img/projects/eiche-parkett-01.webp" alt={t('packages.items.wohnung.alt')} width="1448" height="1086" loading="lazy" />
            <div className="pkg-card__body">
              <span className="pkg-card__num">{t('packages.items.wohnung.num')}</span>
              <h3 className="pkg-card__title"><Trans i18nKey="home:packages.items.wohnung.title" components={RICH} /></h3>
              <p className="pkg-card__desc">{t('packages.items.wohnung.desc')}</p>
              <span className="pkg-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
          <Link className="pkg-card reveal" data-delay="3" to="/gastronomie-ausbau">
            <img src="/assets/img/proj-restaurant-dining.webp" alt={t('packages.items.gastronomie.alt')} width="1448" height="1086" loading="lazy" />
            <div className="pkg-card__body">
              <span className="pkg-card__num">{t('packages.items.gastronomie.num')}</span>
              <h3 className="pkg-card__title"><Trans i18nKey="home:packages.items.gastronomie.title" components={RICH} /></h3>
              <p className="pkg-card__desc">{t('packages.items.gastronomie.desc')}</p>
              <span className="pkg-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
          <Link className="pkg-card reveal" data-delay="4" to="/buero-ausbau">
            <img src="/assets/img/photo-office-modern.webp" alt={t('packages.items.buero.alt')} width="1536" height="1024" loading="lazy" />
            <div className="pkg-card__body">
              <span className="pkg-card__num">{t('packages.items.buero.num')}</span>
              <h3 className="pkg-card__title"><Trans i18nKey="home:packages.items.buero.title" components={RICH} /></h3>
              <p className="pkg-card__desc">{t('packages.items.buero.desc')}</p>
              <span className="pkg-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
        </div>
      </section>

      {/* SERVICES OVERVIEW */}
      <section className="packages-showcase">
        <div className="packages-showcase__head">
          <div className="reveal">
            <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('trades.eyebrow')}</div>
            <h2>
              <Trans i18nKey="home:trades.title" components={RICH} />
            </h2>
          </div>
          <div className="packages-showcase__aside reveal" data-delay="1">
            <p>{t('trades.intro')}</p>
            <Link className="btn btn--light packages-showcase__head-cta" to="/gewerke">
              {t('trades.viewAll')} <span className="arrow">&gt;</span>
            </Link>
          </div>
        </div>
        <div className="packages-showcase__grid" aria-label={t('trades.eyebrow')}>
          {TRADES_PREVIEW.map((tr, i) => (
            <Link className="packages-showcase-card reveal" data-delay={(i % 4) + 1} to={tr.detailTo ?? '/gewerke'} key={tr.num}>
              <span className="packages-showcase-card__media">
                <img src={PREVIEW_IMAGES[tr.key]} alt="" width="400" height="300" loading="lazy" />
                <span className="packages-showcase-card__badge" aria-hidden="true">{tr.num}</span>
              </span>
              <span className="packages-showcase-card__body">
                <span className="packages-showcase-card__num">№ {tr.num}</span>
                <span className="packages-showcase-card__title">{t(`trades.preview.${tr.key}.name`)}</span>
                <span className="packages-showcase-card__desc">{t(`trades.preview.${tr.key}.lead`)}</span>
                <span className="packages-showcase-card__more">
                  <span>{t('common:cta.learnMore')}</span>
                  <span aria-hidden="true">&gt;</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
        <div className="packages-showcase__process reveal" data-delay="2">
          <div className="packages-showcase__process-title">
            <span className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('promise.eyebrow')}</span>
            <strong><Trans i18nKey="home:promise.title" components={RICH} /></strong>
          </div>
        <div className="packages-showcase__steps">
          {PROMISE_STEP_KEYS.map((stepKey, index) => (
              <div className="packages-showcase__step" key={stepKey}>
                <span className="packages-showcase__step-icon" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="packages-showcase__step-copy">
                  <span>{t(`promise.list.${stepKey}.title`)}</span>
                  <small>{t(`promise.list.${stepKey}.desc`)}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="packages-showcase__cta-strip reveal" data-delay="3">
          <div className="packages-showcase__cta-copy">
            <strong>{t('finalCta.appointment')}</strong>
            <span>{t('finalCta.p')}</span>
          </div>
          <div className="packages-showcase__cta-actions">
            <Link className="btn btn--appointment btn--shimmer" to="/kontakt">
              {t('finalCta.appointment')} <span className="arrow">&gt;</span>
            </Link>
            <Link className="btn btn--solid" to="/blitz-angebot">
              {t('finalCta.expressQuote')} <span className="arrow">&gt;</span>
            </Link>
          </div>
        </div>
      </section>

      <HomeHeroPhotos />

      {/* PROMISE */}
      <section className="promise">
        <div className="promise__inner">
          <div className="reveal">
            <div className="promise__num">{t('promise.eyebrow')}</div>
            <h2 className="promise__title">
              <Trans i18nKey="home:promise.title" components={RICH} />
            </h2>
          </div>
          <div className="promise__copy reveal" data-delay="1">
            <p>{t('promise.p1')}</p>
            <p>{t('promise.p2')}</p>
            <ul className="promise__list">
              {PROMISE_STEP_KEYS.map((stepKey, index) => (
                <li key={stepKey}>
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="promise__list-copy">
                    <strong>{t(`promise.list.${stepKey}.title`)}</strong>
                    <small>{t(`promise.list.${stepKey}.desc`)}</small>
                  </span>
                </li>
              ))}
            </ul>
            <div className="promise__actions">
              <Link className="btn btn--appointment btn--shimmer promise__appointment" to="/kontakt">
                {t('finalCta.appointment')} <span className="arrow">&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FeaturedProjects />

      {/* STATS */}
      <section className="stats">
        <div className="stats__inner">
          <div className="stats__intro">
            <h2 className="reveal">
              <Trans i18nKey="home:stats.title" components={RICH} />
            </h2>
            <p className="reveal" data-delay="1">{t('stats.intro')}</p>
          </div>
          <div className="stats__grid">
            <div className="stat reveal">
              <span className="stat__label">{t('stats.since.label')}</span>
              <Counter className="stat__num" target={2006} style={{ textAlign: 'left' }} />
              <span className="stat__desc">{t('stats.since.desc')}</span>
            </div>
            <div className="stat reveal" data-delay="1">
              <span className="stat__label">{t('stats.projects.label')}</span>
              <Counter className="stat__num" target={412} />
              <span className="stat__desc">{t('stats.projects.desc')}</span>
            </div>
            <div className="stat reveal" data-delay="2">
              <span className="stat__label">{t('stats.trades.label')}</span>
              <Counter className="stat__num" target={18} />
              <span className="stat__desc">{t('stats.trades.desc')}</span>
            </div>
            <div className="stat reveal" data-delay="3">
              <span className="stat__label">{t('stats.onTime.label')}</span>
              <Counter className="stat__num" target={98} suffix="%" />
              <span className="stat__desc">{t('stats.onTime.desc')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* KALKULATOR — live interactive */}
      <section className="kalk">
        <div className="kalk__inner">
          <div className="kalk__head reveal">
            <div className="eyebrow eyebrow--on-dark"><span className="rule-red"></span>&nbsp;&nbsp;{t('calculator.eyebrow')}</div>
            <h2>
              <Trans i18nKey="home:calculator.title" components={RICH} />
            </h2>
            <p>{t('calculator.p')}</p>
            <ul className="kalk__steps">
              <li><span className="num">01</span>{t('calculator.steps.1')}</li>
              <li><span className="num">02</span>{t('calculator.steps.2')}</li>
              <li><span className="num">03</span>{t('calculator.steps.3')}</li>
            </ul>
            <div className="kalk__actions">
              <Link className="btn btn--solid" to="/kalkulator">
                {t('calculator.toCalculator')} <span className="arrow">&gt;</span>
              </Link>
              <Link className="btn btn--appointment" to="/kontakt">
                {t('calculator.appointment')} <span className="arrow">&gt;</span>
              </Link>
            </div>
          </div>
          <HomeKalkulatorLive />
        </div>
      </section>

      {/* BLITZ-ANGEBOT — written 24h quote */}
      <section className="blitz-home">
        <div className="blitz-home__inner">
          <HomeBlitzLive />
          <div className="blitz-home__head reveal" data-delay="1">
            <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('blitz.eyebrow')}</div>
            <h2>
              <Trans i18nKey="home:blitz.title" components={RICH} />
            </h2>
            <p>{t('blitz.p')}</p>
            <ul className="blitz-home__list">
              <li><span className="num">01</span>{t('blitz.steps.1')}</li>
              <li><span className="num">02</span>{t('blitz.steps.2')}</li>
              <li><span className="num">03</span>{t('blitz.steps.3')}</li>
            </ul>
            <div className="blitz-home__actions">
              <Link className="btn btn--solid" to="/blitz-angebot">
                {t('blitz.request')} <span className="arrow">&gt;</span>
              </Link>
              <Link className="btn btn--appointment" to="/kontakt">
                {t('blitz.appointment')} <span className="arrow">&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HEATING */}
      <section className="heating">
        <div className="heating__head reveal">
          <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('heating.eyebrow')}</div>
          <h2>
            <Trans i18nKey="home:heating.title" components={RICH} />
          </h2>
          <p>{t('heating.p')}</p>
        </div>
        <div className="heating__grid">
          <Link className="heat-card reveal" to="/waermepumpe">
            <div className="heat-card__photo">
              <img src="/assets/img/leistungen/waermepumpe-01.webp" alt={t('heating.pump.alt')} width="1536" height="1024" loading="lazy" />
            </div>
            <div className="heat-card__body">
              <span className="heat-card__num">{t('heating.pump.num')}</span>
              <h3 className="heat-card__title"><Trans i18nKey="home:heating.pump.title" components={RICH} /></h3>
              <p className="heat-card__desc">{t('heating.pump.desc')}</p>
              <span className="heat-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
          <Link className="heat-card reveal" data-delay="1" to="/heizstraenge">
            <div className="heat-card__photo">
              <img src="/assets/img/leistungen/wasserinstallation-04.webp" alt={t('heating.risers.alt')} width="900" height="1600" loading="lazy" />
            </div>
            <div className="heat-card__body">
              <span className="heat-card__num">{t('heating.risers.num')}</span>
              <h3 className="heat-card__title"><Trans i18nKey="home:heating.risers.title" components={RICH} /></h3>
              <p className="heat-card__desc">{t('heating.risers.desc')}</p>
              <span className="heat-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
          <Link className="heat-card reveal" data-delay="2" to="/heizkoerper">
            <div className="heat-card__photo">
              <img src="/assets/img/leistungen/heizkoerper-01.webp" alt={t('heating.radiators.alt')} width="700" height="700" loading="lazy" />
            </div>
            <div className="heat-card__body">
              <span className="heat-card__num">{t('heating.radiators.num')}</span>
              <h3 className="heat-card__title"><Trans i18nKey="home:heating.radiators.title" components={RICH} /></h3>
              <p className="heat-card__desc">{t('heating.radiators.desc')}</p>
              <span className="heat-card__more">{t('common:cta.learnMore')} <span>&gt;</span></span>
            </div>
          </Link>
        </div>
        <div className="heating__more reveal">
          <Link className="btn btn--light" to="/heizmethoden">
            {t('heating.viewAll')} <span className="arrow">&gt;</span>
          </Link>
          <Link className="btn btn--appointment" to="/kontakt">
            {t('finalCta.appointment')} <span className="arrow">&gt;</span>
          </Link>
        </div>
      </section>

      {/* FOUNDERS */}
      <section className="founders" id="ueber-uns">
        <div className="founders__inner">
          <div className="founders__media reveal reveal--left">
            <div className="founders__photo">
              <img src="/assets/img/founders.webp" alt={t('founders.photoAlt')} width="1500" height="1000" loading="lazy" />
              <div className="founders__photo-label">
                <span>{t('founders.photoLabel')}</span>
              </div>
            </div>
            <Link className="btn btn--appointment btn--shimmer founders__appointment" to="/kontakt">
              {t('finalCta.appointment')} <span className="arrow">&gt;</span>
            </Link>
          </div>
          <div className="founders__body reveal reveal--right" data-delay="1">
            <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span className="rule-red"></span>&nbsp;{t('founders.eyebrow')}
            </div>
            <h2>
              <Trans i18nKey="home:founders.title" components={RICH} />
            </h2>
            <p>{t('founders.p1')}</p>
            <p>{t('founders.p2')}</p>
            <div className="founders__sig">
              <span className="founders__sig-name">{t('founders.sigName')}</span>
              <span className="founders__sig-role">{t('founders.sigRole')}</span>
            </div>
            <HomeAboutVideo />
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <GoogleReviews
        fallback={{
          quote: t('testimonial.quote'),
          name: t('testimonial.name'),
          meta: t('testimonial.meta'),
        }}
      />

      {/* INSTAGRAM — hidden until the account is connected */}
      <InstagramFeed />

      {/* FINAL CTA */}
      <section className="end-cta">
        <div className="end-cta__inner reveal-group">
          <h2>
            <Trans i18nKey="home:finalCta.title" components={RICH} />
          </h2>
          <p>{t('finalCta.p')}</p>
          <div className="end-cta__buttons">
            <Link className="btn btn--appointment btn--shimmer" to="/kontakt">
              {t('finalCta.appointment')} <span className="arrow">&gt;</span>
            </Link>
            <Link className="btn btn--dark" to="/kalkulator">
              {t('finalCta.toCalculator')} <span className="arrow">&gt;</span>
            </Link>
            <Link className="btn btn--dark" to="/blitz-angebot">
              {t('finalCta.expressQuote')} <span className="arrow">&gt;</span>
            </Link>
            <a className="btn btn--dark" href="tel:+4915789818308" style={{ borderColor: 'rgba(236, 229, 223, .25)' }}>
              +49 1578 98 18 308
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

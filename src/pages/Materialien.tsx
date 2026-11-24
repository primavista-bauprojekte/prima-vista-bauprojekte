import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { businessContact } from '../../shared/contact';
import EndCtaLocal from '../components/common/EndCtaLocal';
import PageIntro from '../components/common/PageIntro';
import CategoryDetail from '../components/materialien/CategoryDetail';
import CategoryGrid from '../components/materialien/CategoryGrid';
import Merkliste from '../components/materialien/Merkliste';
import { MATERIAL_CATEGORIES, categoryFromHash, type MaterialCatalogue } from '../data/materialien';
import { useMerkliste } from '../hooks/useMerkliste';
import { usePageTitle } from '../hooks/usePageTitle';
import '../styles/pages/materialien.css';

// pdf.js and page-flip only load once a catalogue is opened.
const CatalogueReader = lazy(() => import('../components/materialien/CatalogueReader'));

export default function Materialien() {
  const { t } = useTranslation('pages');
  const { hash } = useLocation();
  const category = categoryFromHash(hash);
  const sectionRef = useRef<HTMLElement>(null);
  const previous = useRef<typeof category>(null);
  const { list, toggle, clear } = useMerkliste();
  const [reading, setReading] = useState<{ catalogue: MaterialCatalogue; page: number } | null>(null);

  usePageTitle(t('material.metaTitle'), t('material.metaDescription'));

  // A category switch is an in-page view change: bring it into view and move
  // focus there. Layout's own scroll effect runs first (layout phase).
  useEffect(() => {
    if (previous.current === category) return undefined;
    const frame = window.requestAnimationFrame(() => {
      previous.current = category;
      sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      sectionRef.current?.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [category]);

  const openCatalogue = useCallback((catalogue: MaterialCatalogue, page: number) => setReading({ catalogue, page }), []);
  const closeCatalogue = useCallback(() => setReading(null), []);

  const meta = t('material.meta', { returnObjects: true }) as { label: string; value: string }[];
  const whatsappHref = `${businessContact.primary.whatsappHref}?text=${encodeURIComponent(t('material.cta.whatsappText'))}`;

  return (
    <>
      <PageIntro
        backgroundImage={MATERIAL_CATEGORIES[0].image}
        backgroundImages={MATERIAL_CATEGORIES.map((entry) => entry.image)}
        crumbNumber="06"
        crumbLabel={t('material.crumbLabel')}
        title={<Trans i18nKey="pages:material.title" components={{ em: <em />, br: <br /> }} />}
        lede={t('material.lede')}
        meta={meta}
      />

      <section className="mat" ref={sectionRef}>
        {category ? <CategoryDetail key={category} category={category} onOpen={openCatalogue} /> : <CategoryGrid />}
      </section>

      <Merkliste list={list} onToggle={toggle} onClear={clear} onOpen={openCatalogue} />

      {list.length === 0 && (
        <section className="mat-whatsapp">
          <div className="mat-shell">
            <p>{t('material.cta.lede')}</p>
            <a className="mat-btn mat-btn--solid" href={whatsappHref} target="_blank" rel="noopener noreferrer">
              {t('material.cta.whatsapp')}
            </a>
          </div>
        </section>
      )}

      <EndCtaLocal
        eyebrow={t('material.cta.eyebrow')}
        title={<Trans i18nKey="pages:material.cta.title" components={{ em: <em />, br: <br /> }} />}
        ctaLabel={t('material.cta.contact')}
        contactPreset={{
          art: 'einzel',
          msg: t('material.cta.contactMessage'),
          sourceLabel: t('material.cta.sourceLabel'),
        }}
      />

      {reading && (
        <Suspense fallback={null}>
          <CatalogueReader
            key={`${reading.catalogue.key}-${reading.page}`}
            catalogue={reading.catalogue}
            initialPage={reading.page}
            onClose={closeCatalogue}
            saved={list}
            onToggleSaved={toggle}
          />
        </Suspense>
      )}
    </>
  );
}

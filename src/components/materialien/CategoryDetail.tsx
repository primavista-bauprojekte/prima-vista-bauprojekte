import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import {
  CATEGORY_HASH_PREFIX,
  MATERIAL_CATEGORIES,
  cataloguesFor,
  partnersFor,
  subcategoriesOf,
  type MaterialCatalogue,
  type MaterialCategoryKey,
  type MaterialSubKey,
} from '../../data/materialien';
import CatalogueCard from './CatalogueCard';
import { useCategoryHref } from './useCategoryHref';

type Props = {
  category: MaterialCategoryKey;
  onOpen: (catalogue: MaterialCatalogue, page: number) => void;
};

// Mounted with `key={category}`, so the sub-filter resets on every switch.
export default function CategoryDetail({ category, onOpen }: Props) {
  const { t } = useTranslation('pages');
  const hrefFor = useCategoryHref();
  const [sub, setSub] = useState<MaterialSubKey | null>(null);

  const subs = subcategoriesOf(category);
  const catalogues = cataloguesFor(sub ?? category);
  const partners = partnersFor(category);

  return (
    <div className="mat-shell">
      <nav className="mat-filter" aria-label={t('material.filterAria')}>
        <RouterLink className="mat-chip mat-chip--back" to={hrefFor('')}>← {t('material.backToCategories')}</RouterLink>
        {MATERIAL_CATEGORIES.map(({ key }) => (
          <RouterLink
            key={key}
            className={`mat-chip${key === category ? ' is-active' : ''}`}
            aria-current={key === category ? 'true' : undefined}
            to={hrefFor(`${CATEGORY_HASH_PREFIX}${key}`)}
          >
            {t(`material.categories.${key}.name`)}
          </RouterLink>
        ))}
      </nav>

      <header className="mat-head">
        <h2 tabIndex={-1}>{t(`material.categories.${category}.name`)}</h2>
        <p>{t(`material.categories.${category}.desc`)}</p>
      </header>

      {subs.length > 0 && (
        <div className="mat-subs" role="group" aria-label={t('material.subfilterAria')}>
          <button type="button" className={`mat-chip${sub === null ? ' is-active' : ''}`} aria-pressed={sub === null} onClick={() => setSub(null)}>
            {t('material.allSubcategories')}
          </button>
          {subs.map(({ key, image }) => (
            <button
              key={key}
              type="button"
              className={`mat-chip mat-chip--image${sub === key ? ' is-active' : ''}`}
              aria-pressed={sub === key}
              onClick={() => setSub(key)}
            >
              <img src={image} alt="" loading="lazy" decoding="async" />
              {t(`material.sub.${key}.name`)}
            </button>
          ))}
        </div>
      )}
      {sub && <p className="mat-subdesc">{t(`material.sub.${sub}.desc`)}</p>}

      {catalogues.length > 0 && (
        <div className="mat-cards">
          {catalogues.map((entry) => <CatalogueCard key={entry.key} catalogue={entry} onOpen={onOpen} />)}
        </div>
      )}
      {catalogues.length === 0 && partners.length === 0 && <p>{t('material.emptyCategory')}</p>}

      {partners.length > 0 && (
        <>
          <h3 className="mat-partners__title">{t('material.partnersHeading')}</h3>
          <ul className="mat-partners">
            {partners.map((partner) => (
              <li key={partner.key}>
                <a className="mat-partner" href={partner.url} target="_blank" rel="noopener noreferrer">
                  <span className="mat-kicker">{t('material.partnerLabel')} · {t(`material.partners.${partner.key}.origin`)}</span>
                  <strong>{partner.name}</strong>
                  <span>{t(`material.partners.${partner.key}.desc`)}</span>
                  <span className="mat-partner__cta">{t('material.partnerCta')} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mat-note">{t('material.sampleNote')}</p>
    </div>
  );
}

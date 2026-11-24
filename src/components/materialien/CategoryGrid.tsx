import { Trans, useTranslation } from 'react-i18next';
import { CATEGORY_HASH_PREFIX, MATERIAL_CATEGORIES, categoryCounts } from '../../data/materialien';
import SectionEyebrow from '../common/SectionEyebrow';
import MaterialIcon from './MaterialIcons';
import { useCategoryHref } from './useCategoryHref';
import { Link as RouterLink } from 'react-router';

export default function CategoryGrid() {
  const { t } = useTranslation('pages');
  const hrefFor = useCategoryHref();

  return (
    <div className="mat-shell">
      <header className="mat-head">
        <SectionEyebrow>{t('material.overviewEyebrow')}</SectionEyebrow>
        <h2><Trans i18nKey="pages:material.overviewTitle" components={{ em: <em />, br: <br /> }} /></h2>
        <p>{t('material.overviewLede')}</p>
      </header>
      <ul className="mat-grid">
        {MATERIAL_CATEGORIES.map((category) => {
          const counts = categoryCounts(category.key);
          return (
            <li key={category.key}>
              <RouterLink className="mat-tile" to={hrefFor(`${CATEGORY_HASH_PREFIX}${category.key}`)}>
                <img src={category.image} alt="" loading="lazy" decoding="async" />
                <span className="mat-tile__body">
                  <MaterialIcon name={category.icon} className="mat-tile__icon" />
                  <strong>{t(`material.categories.${category.key}.name`)}</strong>
                  <span>{t(`material.categories.${category.key}.desc`)}</span>
                  <span className="mat-tile__badges">
                    {counts.catalogues > 0 && (
                      <span>{counts.catalogues === 1 ? t('material.badgeCatalogueOne') : t('material.badgeCatalogueMany', { count: counts.catalogues })}</span>
                    )}
                    {counts.partners > 0 && (
                      <span>{counts.partners === 1 ? t('material.badgePartnerOne') : t('material.badgePartnerMany', { count: counts.partners })}</span>
                    )}
                  </span>
                </span>
              </RouterLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

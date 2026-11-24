import { useTranslation } from 'react-i18next';
import type { MaterialCatalogue } from '../../data/materialien';

type Props = {
  catalogue: MaterialCatalogue;
  onOpen: (catalogue: MaterialCatalogue, page: number) => void;
};

export default function CatalogueCard({ catalogue, onOpen }: Props) {
  const { t } = useTranslation('pages');
  const base = `material.catalogues.${catalogue.key}`;
  const name = t(`${base}.name`);

  return (
    <article className="mat-card">
      <button
        type="button"
        className="mat-card__cover"
        onClick={() => onOpen(catalogue, 1)}
        aria-label={t('material.openCatalogueAria', { name })}
      >
        <img src={catalogue.cover} alt="" loading="lazy" decoding="async" />
      </button>
      <div className="mat-card__body">
        <p className="mat-kicker">{t('material.catalogueLabel', { count: catalogue.pages })}</p>
        <h3>{name}</h3>
        <p>{t(`${base}.desc`)}</p>
        <ul className="mat-card__chapters">
          {catalogue.chapters.map((chapter) => (
            <li key={chapter.key}>
              <button type="button" onClick={() => onOpen(catalogue, chapter.page)}>
                {t(`${base}.chapters.${chapter.key}`)} <span>{t('material.pageShort', { page: chapter.page })}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mat-card__actions">
          <button type="button" className="mat-btn mat-btn--solid" onClick={() => onOpen(catalogue, 1)}>
            {t('material.openCatalogue')}
          </button>
          <a className="mat-btn" href={catalogue.file} target="_blank" rel="noopener noreferrer">
            {t('material.openPdf')}
          </a>
        </div>
      </div>
    </article>
  );
}

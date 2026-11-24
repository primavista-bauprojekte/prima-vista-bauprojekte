import { useTranslation } from 'react-i18next';
import { businessContact } from '../../../shared/contact';
import { MATERIAL_CATALOGUES, type MaterialCatalogue } from '../../data/materialien';
import { savedLabel, type SavedPage } from '../../data/merkliste';
import { Link } from '../../i18n/Link';

type Props = {
  list: SavedPage[];
  onToggle: (entry: SavedPage) => void;
  onClear: () => void;
  onOpen: (catalogue: MaterialCatalogue, page: number) => void;
};

export default function Merkliste({ list, onToggle, onClear, onOpen }: Props) {
  const { t } = useTranslation('pages');
  const nameOf = (entry: SavedPage) => t(`material.catalogues.${entry.catalogue}.name`);
  const pageOf = (entry: SavedPage) => t('material.pageShort', { page: savedLabel(entry) });
  const lines = list.map((entry) => `• ${nameOf(entry)}, ${pageOf(entry)}`).join('\n');
  const whatsappHref = `${businessContact.primary.whatsappHref}?text=${encodeURIComponent(`${t('material.cta.whatsappText')}\n${lines}`)}`;

  return (
    <section className="mat-list" id="merkliste" aria-labelledby="merkliste-title">
      <div className="mat-shell">
        <header className="mat-head">
          <h2 id="merkliste-title">{t('material.list.title')} <span>({list.length})</span></h2>
          <p>{list.length === 0 ? t('material.list.empty') : t('material.list.lede')}</p>
        </header>
        {list.length > 0 && (
          <>
            <ul className="mat-list__items">
              {list.map((entry) => {
                const catalogue = MATERIAL_CATALOGUES.find((item) => item.key === entry.catalogue);
                if (!catalogue) return null;
                const label = `${nameOf(entry)}, ${pageOf(entry)}`;
                return (
                  <li key={`${entry.catalogue}-${entry.page}`}>
                    <button type="button" className="mat-list__open" onClick={() => onOpen(catalogue, entry.page)}>
                      <img src={entry.thumb ?? catalogue.cover} alt="" />
                      <strong>{nameOf(entry)}</strong>
                      <span>{pageOf(entry)}</span>
                    </button>
                    <button
                      type="button"
                      className="mat-list__remove"
                      onClick={() => onToggle(entry)}
                      aria-label={t('material.list.remove', { name: label })}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mat-card__actions">
              <a className="mat-btn mat-btn--solid" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                {t('material.list.whatsapp')}
              </a>
              <Link
                className="mat-btn"
                to="/kontakt"
                state={{
                  contact: {
                    art: 'einzel',
                    msg: `${t('material.cta.contactMessage')}\n${lines}`,
                    sourceLabel: t('material.cta.sourceLabel'),
                  },
                }}
              >
                {t('material.cta.contact')}
              </Link>
              <button type="button" className="mat-btn" onClick={onClear}>{t('material.list.clear')}</button>
            </div>
          </>
        )}
        <p className="mat-note">{t('material.list.privacy')}</p>
      </div>
    </section>
  );
}

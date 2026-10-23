import { businessContact } from '../../shared/contact';
import ContactNumbers from '../components/ContactNumbers';
import { useTranslation } from 'react-i18next';
import PageIntro from '../components/common/PageIntro';
import '../styles/pages/impressum.css';

const COMPANY_DETAILS = [
  'Prima Vista Bauprojekte',
  'Monica Irimia',
  'Gref-Völsing-Straße 13',
  '60314 Frankfurt',
  'Steuernr.: 01483039527',
];

export default function Impressum() {
  const { t } = useTranslation('legal');

  const sections = [
    { key: 'vat', body: (
      <p>
        {t('impressum.vat.body')}
        <br />
        DE 358812805
      </p>
    ) },
    { key: 'authority', body: <p>{t('impressum.authority.body')}</p> },
    { key: 'odr', body: (
      <p>
        {t('impressum.odr.pre')}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>
        {t('impressum.odr.post')}
      </p>
    ) },
    { key: 'consumer', body: <p>{t('impressum.consumer.body')}</p> },
    { key: 'content', body: <><p>{t('impressum.content.p1')}</p><p>{t('impressum.content.p2')}</p></> },
    { key: 'links', body: <><p>{t('impressum.links.p1')}</p><p>{t('impressum.links.p2')}</p></> },
    { key: 'copyright', body: <><p>{t('impressum.copyright.p1')}</p><p>{t('impressum.copyright.p2')}</p></> },
  ];

  return (
    <>
      <PageIntro
        className="impressum-intro"
        backgroundImage="/assets/img/photo-office-light.webp"
        crumbNumber="07"
        crumbLabel={t('impressum.crumbLabel')}
        title={t('impressum.title')}
        lede={t('impressum.lede')}
        meta={[
          { label: t('impressum.metaSeat'), value: 'Frankfurt am Main' },
          { label: t('impressum.metaContact'), value: 'info@primavista-bauprojekte.com' },
          { label: t('common:contact.primary'), value: <a href={businessContact.primary.telHref}>{businessContact.primary.display}</a> },
          { label: t('impressum.metaVat'), value: 'DE 358812805' },
        ]}
      />

      <main className="impressum-page">
        <section className="impressum-page__grid">
          <aside className="impressum-page__summary reveal">
            <div className="eyebrow"><span className="rule-red"></span>&nbsp;&nbsp;{t('impressum.summaryEyebrow')}</div>
            <address>
              {COMPANY_DETAILS.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <div className="impressum-page__contact">
              <h2>{t('impressum.contactHeading')}</h2>
              <p>
                <ContactNumbers />
                <br />
                {t('impressum.emailLabel')}: <a href="mailto:info@primavista-bauprojekte.com">info@primavista-bauprojekte.com</a>
              </p>
            </div>
            <p className="impressum-page__binding">{t('bindingNote')}</p>
          </aside>

          <div className="impressum-page__content">
            {sections.map((section, index) => (
              <section key={section.key} className="impressum-section reveal" data-delay={index % 3 || undefined}>
                <span className="impressum-section__num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{t(`impressum.${section.key}.title`)}</h2>
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

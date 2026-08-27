import { Trans, useTranslation } from 'react-i18next';
import { MailIcon, PhoneIcon } from '../icons';

export default function KontaktIntro() {
  const { t } = useTranslation('kontakt');
  return (
    <div className="kontakt__intro reveal reveal--left">
      <div className="crumb crumb--on-dark"><span className="num">05</span> {t('intro.crumb')}</div>
      <h1>
        <Trans i18nKey="kontakt:intro.title" components={{ em: <em />, br: <br /> }} />
      </h1>
      <p>{t('intro.lede')}</p>

      <div className="kontakt__channels">
        <div className="kontakt__channel">
          <div className="kontakt__channel-icon"><PhoneIcon /></div>
          <div className="kontakt__channel-body">
            <h4 className="kontakt__channel-label">{t('intro.phoneLabel')}</h4>
            <p className="kontakt__channel-val">
              <a href="tel:+4915789818308">+49 1578 98 18 308</a>
              <br />
              <a href="tel:+41782659332">+41 78 265 93 32</a>
            </p>
            <p className="kontakt__channel-meta">{t('intro.phoneMeta')}</p>
          </div>
        </div>
        <div className="kontakt__channel">
          <div className="kontakt__channel-icon"><MailIcon /></div>
          <div className="kontakt__channel-body">
            <h4 className="kontakt__channel-label">{t('intro.emailLabel')}</h4>
            <p className="kontakt__channel-val">
              <a href="mailto:office@primavista-bauprojekte.com">office@primavista-bauprojekte.com</a>
              <br />
              <a href="mailto:info@primavista-bauprojekte.ch">info@primavista-bauprojekte.ch</a>
            </p>
            <p className="kontakt__channel-meta">{t('intro.emailMeta')}</p>
          </div>
        </div>
        <div className="kontakt__channel">
          <div className="kontakt__channel-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div className="kontakt__channel-body">
            <h4 className="kontakt__channel-label">{t('intro.consultLabel')}</h4>
            <p className="kontakt__channel-val">{t('intro.consultValue')}</p>
            <p className="kontakt__channel-meta">{t('intro.consultMeta')}</p>
          </div>
        </div>
      </div>

      <div className="kontakt__offices">
        <div className="kontakt__office">
          <h4>{t('intro.officeDe')}</h4>
          <p><strong>Prima Vista Bauprojekte</strong><br />
            Gref-Völsing-Strasse 13<br />
            60314 Frankfurt<br />
            {t('intro.countryDe')}<br />
            <a href="tel:+4915789818308">+49 1578 98 18 308</a></p>
        </div>
        <div className="kontakt__office">
          <h4>{t('intro.officeCh')}</h4>
          <p><strong>Prima Vista Bauprojekte GmbH</strong><br />
            Spinnereistrasse 5<br />
            6020 Emmenbrücke<br />
            {t('intro.countryCh')}<br />
            <a href="tel:+41782659332">+41 78 265 93 32</a></p>
        </div>
      </div>

      <figure className="kontakt__media">
        <img src="/assets/img/photo-office-light.webp" alt={t('intro.mediaAlt')} width="1600" height="1200" loading="lazy" />
        <figcaption>
          <span className="num">№ 05</span>
          <span>{t('intro.mediaCaption')}</span>
        </figcaption>
      </figure>
    </div>
  );
}

import { businessContact } from '../../shared/contact';
import ContactNumbers from './ContactNumbers';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Link } from '../i18n/Link';
import { toCanonicalPath } from '../i18n/routes';
import { openConsentBanner } from '../hooks/useConsent';
import { ChatIcon, FacebookIcon, InstagramIcon, MailIcon, YoutubeIcon } from './icons';

export default function Footer() {
  const { t } = useTranslation();
  const pathname = toCanonicalPath(useLocation().pathname);
  return (
    <footer className="pv-footer">
      <div className="pv-footer__inner">
        <div className="pv-footer__grid">
          <div className="pv-footer__brand">
            <Link
              className="pv-logo"
              to="/"
              aria-label="Prima Vista"
              onClick={() => {
                if (pathname === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              <img src="/assets/img/logo.png" alt="" width="1085" height="1051" loading="lazy" />
              <span className="pv-logo__txt">
                <span className="pv-logo__name">Prima Vista</span>
                <span className="pv-logo__tag">Bauprojekte</span>
              </span>
            </Link>
            <p className="pv-footer__brand-blurb">{t('footer.blurb')}</p>
            <div className="pv-footer__socials">
              <Link className="pv-footer__contact-icon pv-footer__contact-icon--brand" to="/#ueber-uns" title={t('footer.about')}>
                <img src="/assets/img/logo.png" alt="" width="1085" height="1051" loading="lazy" />
              </Link>
              <a className="pv-footer__contact-icon" href="https://www.instagram.com/primavista.bauprojekte" target="_blank" rel="noopener noreferrer" title="Instagram">
                <InstagramIcon />
              </a>
              <a className="pv-footer__contact-icon" href="https://www.facebook.com/profile.php?id=61584837772416" target="_blank" rel="noopener noreferrer" title="Facebook">
                <FacebookIcon />
              </a>
              <a className="pv-footer__contact-icon" href="https://www.youtube.com/@PrimaVistaBauprojekte" target="_blank" rel="noopener noreferrer" title="YouTube">
                <YoutubeIcon />
              </a>
            </div>
          </div>
          <div>
            <h3>{t('footer.locations')}</h3>
            <ul className="pv-footer__contact-list">
              <li>
                <div className="pv-footer__contact-link pv-footer__contact-link--static">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">DE</span>
                  <span>
                    <strong>Frankfurt</strong>
                    <br />
                    Gref-Völsing-Strasse 13
                    <br />
                    60314 Frankfurt
                    <br />
                    {t('footer.countryDe')}
                    <br />
                    <a href={businessContact.primary.telHref}>{businessContact.primary.display}</a>
                  </span>
                </div>
              </li>
              <li>
                <div className="pv-footer__contact-link pv-footer__contact-link--static">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">CH</span>
                  <span>
                    <strong>Emmenbrücke</strong>
                    <br />
                    Spinnereistrasse 5
                    <br />
                    6020 Emmenbrücke
                    <br />
                    {t('footer.countryCh')}
                    <br />
                    <a href={businessContact.swiss.telHref}>{businessContact.swiss.display}</a>
                  </span>
                </div>
              </li>
            </ul>
          </div>
          <div>
            <h3>{t('footer.services')}</h3>
            <ul className="pv-footer__contact-list">
              <li>
                <Link className="pv-footer__contact-link" to="/komplett-pakete">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">01</span>
                  <span>{t('footer.links.packages')}</span>
                </Link>
              </li>
              <li>
                <Link className="pv-footer__contact-link" to="/gewerke">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">02</span>
                  <span>{t('footer.links.trades')}</span>
                </Link>
              </li>
              <li>
                <Link className="pv-footer__contact-link" to="/heizmethoden">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">03</span>
                  <span>{t('footer.links.heating')}</span>
                </Link>
              </li>
              <li>
                <Link className="pv-footer__contact-link" to="/kalkulator">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">04</span>
                  <span>{t('footer.links.calculator')}</span>
                </Link>
              </li>
              <li>
                <Link className="pv-footer__contact-link" to="/projekte">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">05</span>
                  <span>{t('footer.links.projects')}</span>
                </Link>
              </li>
              <li>
                <Link className="pv-footer__contact-link" to="/blitz-angebot">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">06</span>
                  <span>{t('footer.links.express')}</span>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>{t('footer.contact')}</h3>
            <ul className="pv-footer__contact-list">
              <li>
                <Link className="pv-footer__contact-link" to="/kontakt">
                  <span className="pv-footer__contact-icon" aria-hidden="true"><ChatIcon /></span>
                  <span>{t('footer.links.contactForm')}</span>
                </Link>
              </li>
              <li>
                <div className="pv-footer__contact-link pv-footer__contact-link--static">
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">DE</span>
                  <ContactNumbers />
                </div>
              </li>
              <li>
                <a className="pv-footer__contact-link" href={businessContact.swiss.telHref}>
                  <span className="pv-footer__contact-icon pv-footer__contact-icon--text" aria-hidden="true">CH</span>
                  <span>{businessContact.swiss.display}</span>
                </a>
              </li>
              <li>
                <a className="pv-footer__contact-link" href="mailto:office@primavista-bauprojekte.com">
                  <span className="pv-footer__contact-icon" aria-hidden="true"><MailIcon /></span>
                  <span>office@primavista-bauprojekte.com</span>
                </a>
              </li>
              <li>
                <a className="pv-footer__contact-link" href="mailto:info@primavista-bauprojekte.ch">
                  <span className="pv-footer__contact-icon" aria-hidden="true"><MailIcon /></span>
                  <span>info@primavista-bauprojekte.ch</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pv-footer__bottom">
          <small>{t('footer.copyright')}</small>
          <div className="pv-footer__legal">
            <Link to="/admin/blog">{t('footer.admin')}</Link>
            <Link to="/impressum">{t('footer.imprint')}</Link>
            <Link to="/datenschutz">{t('footer.privacy')}</Link>
            <button className="pv-cookie-settings" type="button" onClick={openConsentBanner}>{t('cookie.settings')}</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

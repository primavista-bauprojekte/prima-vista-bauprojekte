import { useTranslation } from 'react-i18next';
import { businessContact } from '../../shared/contact';
import '../styles/components/contact-numbers.css';

/** Compact contact list shared by the menu, footer, contact page and chat. */
export default function ContactNumbers({ includeSwiss = false }: { includeSwiss?: boolean }) {
  const { t } = useTranslation();
  const contacts = includeSwiss ? ['primary', 'secondary', 'swiss'] as const : ['primary', 'secondary'] as const;
  return (
    <span className="pv-phone-contacts">
      {contacts.map((role) => (
        <span className="pv-phone-contacts__item" key={role}>
          <span className="pv-phone-contacts__label">{t(`contact.${role}`)}</span>
          <a href={businessContact[role].telHref}>{businessContact[role].display}</a>
        </span>
      ))}
    </span>
  );
}

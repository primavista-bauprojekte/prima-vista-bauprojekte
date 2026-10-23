import { businessContact } from '../../shared/contact';

const schema = {
  '@context': 'https://schema.org',
  '@type': 'HomeAndConstructionBusiness',
  name: 'Prima Vista Bauprojekte',
  url: 'https://primavista-bauprojekte.com/',
  telephone: businessContact.primary.international,
  contactPoint: [
    { '@type': 'ContactPoint', name: 'Hauptkontakt', contactType: 'customer service', telephone: businessContact.primary.international },
    { '@type': 'ContactPoint', name: 'Alternativer Kontakt (Sonja)', contactType: 'customer service', telephone: businessContact.secondary.international },
    { '@type': 'ContactPoint', name: 'Kontakt Schweiz', contactType: 'customer service', areaServed: 'CH', telephone: businessContact.swiss.international },
  ],
};

export default function BusinessContactSchema() {
  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
}

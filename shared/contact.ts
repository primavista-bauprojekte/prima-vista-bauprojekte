/** Confirmed public contacts. Keep the Swiss contact until its role is confirmed. */
export const businessContact = {
  primary: {
    display: '+49 176 48747554',
    international: '+4917648747554',
    telHref: 'tel:+4917648747554',
    whatsappHref: 'https://wa.me/4917648747554',
  },
  secondary: {
    display: '+49 1578 9818308',
    international: '+4915789818308',
    telHref: 'tel:+4915789818308',
  },
  swiss: {
    display: '+41 78 265 93 32',
    international: '+41782659332',
    telHref: 'tel:+41782659332',
  },
} as const;

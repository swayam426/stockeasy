/**
 * Company details printed on quotation PDFs.
 * Edit these to match your registration documents — they appear on
 * everything you send to clients.
 */
export const COMPANY = {
  name: 'Raj Agencies',
  tagline: 'Inventory Management',
  logo: '/logo.png',

  address: [
    'No. 52, 59 2nd Floor, Sarathy Mansion',
    'Vellore, Tamil Nadu - 632004',
  ],

  phone: '+91 99447 79535',
  email: 'rajagencies58@gmail.com',

  defaultTerms: [
    'This quotation is valid until the date mentioned above.',
    'Prices are subject to change without prior notice after the validity period.',
    'Goods once sold will not be taken back or exchanged.',
    'Delivery timelines are indicative and subject to stock availability.',
  ].join('\n'),

  defaultPaymentTerms: '50% advance, balance on delivery.',
};

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

  // GSTIN printed in the letterhead.
  gst: '33BFVPM21521Z6',

  /**
   * Letterhead image.
   *
   * Save your header strip (wordmark + address + logo, as one picture)
   * into the `public` folder and point `src` at it. When set, the whole
   * text header below is replaced by this image on both the screen and
   * the PDF — so the printed quotation matches your stationery exactly.
   *
   * Sizing is yours to control:
   *   widthMm   how wide it prints. 186 = full width inside the margins,
   *             210 = edge to edge on A4.
   *   heightMm  how tall. Set to null to keep the image's own proportions
   *             (recommended — a wrong value here squashes the artwork).
   *   fullBleed true runs it right to the paper edge, ignoring margins.
   *   offsetXMm nudges the image sideways. Artwork cropped out of a PDF
   *             usually carries blank space down one side; a NEGATIVE
   *             value pulls it left so the wordmark lines up with the
   *             text beneath it, without re-cropping the file.
   *
   * Set src to null to go back to the text letterhead.
   */
  letterhead: {
    src: '/letterhead.png',
    widthMm: 200,
    heightMm: null,
    fullBleed: false,
  
  },

  // Used only when no letterhead image is configured or it fails to load.
  brand: {
    // The "RAJ AGENCIES" wordmark colour (RGB).
    color: [106, 27, 122],
    // Yellow fill behind the items-table header row.
    tableHeader: [255, 255, 0],
  },

  // Lines printed under the items table, exactly as on the house format.
  footerNotes: [
    'TAX INCLUDED 18%.',
    'IMMEDIATE PAYMENT AFTER DELIVERY',
    'QUOTATION VALID FOR 7 DAYS',
  ],

  defaultTerms: [
    'This quotation is valid until the date mentioned above.',
    'Prices are subject to change without prior notice after the validity period.',
    'Goods once sold will not be taken back or exchanged.',
    'Delivery timelines are indicative and subject to stock availability.',
  ].join('\n'),

  defaultPaymentTerms: '50% advance, balance on delivery.',
};

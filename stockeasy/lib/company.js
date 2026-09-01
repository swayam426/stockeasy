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

  /**
   * Letterhead for the INDIVIDUAL quotation format, which uses a different
   * layout: logo on the left, wordmark centred, address centred beneath.
   *
   * Save that strip as public/letterhead-individual.png. Until it exists,
   * both the screen and the PDF draw the header from text in the same
   * arrangement, so individual quotations work straight away.
   */
  letterheadIndividual: {
    src: '/letterhead-individual.png',
    // 2193x442px, so 186mm wide prints about 37mm tall.
    widthMm: 186,
    heightMm: null,
    fullBleed: false,
    offsetXMm: -6,
  },

  // Used only when no letterhead image is configured or it fails to load.
  brand: {
    // The "RAJ AGENCIES" wordmark colour (RGB).
    color: [106, 27, 122],
    // Yellow fill behind the items-table header row.
    tableHeader: [255, 255, 0],
  },

  /**
   * The covering wording above the items table. Edit these two lines to
   * change what every quotation says — they're used by the company PDF,
   * the individual PDF and the on-screen view, so one edit covers all.
   *
   * {subject} is replaced by the Subject you type on the form. When the
   * Subject is left blank, `introNoSubject` is used instead so the
   * sentence doesn't end up with empty quote marks.
   */
  greeting: 'Dear Sir',
  intro: 'We take pleasure in offering you a quotation for “{subject}”. Accordance with the below terms and conditions.',
  introNoSubject: 'We take pleasure in offering you a quotation. Accordance with the below terms and conditions.',

  // Footer note for the individual format, where rates already include tax.
  footerNotesIndividual: [
    'TAX INCLUDED 18%',
  ],

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

/**
 * Builds the covering sentence from COMPANY.intro / COMPANY.introNoSubject.
 * Kept here beside the wording so the PDF templates and the screen view
 * can never drift apart.
 */
export function quoteIntro(subject) {
  const s = String(subject || '').trim();
  if (!s) return COMPANY.introNoSubject;
  return String(COMPANY.intro).replace('{subject}', s);
}

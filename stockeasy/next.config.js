/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    // jsPDF lists canvg, html2canvas and dompurify as OPTIONAL dependencies.
    // They're only needed for doc.html() and SVG rendering — we build the
    // quotation PDF from text and table primitives, so none of them are used.
    //
    // Webpack still follows the import chain (jspdf → canvg → core-js) and
    // tries to bundle the lot, which drags in thousands of core-js polyfill
    // files. Aliasing them to false stops webpack at the door: the code path
    // is never taken at runtime, and the bundle stays small.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvg: false,
      html2canvas: false,
      dompurify: false,
    };

    return config;
  },
};

module.exports = nextConfig;

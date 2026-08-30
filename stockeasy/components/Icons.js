/**
 * Inline SVG icons.
 *
 * Drawn as strokes with `currentColor`, so they inherit the button's text
 * colour and work in both light and dark mode without a second asset.
 * Inline rather than image files means no extra network request and no
 * flash of missing icon on first paint.
 */

export function DownloadCloud({ size = 16, strokeWidth = 1.7, style, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...props}
    >
      {/* Cloud outline, left open at the base so the arrow passes through */}
      <path d="M8.6 15.4H6.1a4.1 4.1 0 0 1-.45-8.18A5.75 5.75 0 0 1 17.05 6.4a3.85 3.85 0 0 1 .6 8.98h-2.25" />
      {/* Shaft */}
      <path d="M12 10.3V20.6" />
      {/* Arrowhead */}
      <path d="M8.75 17.35 12 20.6l3.25-3.25" />
    </svg>
  );
}

export default { DownloadCloud };

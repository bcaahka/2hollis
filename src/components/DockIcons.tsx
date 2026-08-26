/** Laconic glyphs in the shop.2hollis.life social-icon language. */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true as const,
};

export const LyricsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} {...iconProps}>
    <path
      d="M4.5 5.5h15v10.5H9.25L4.5 20V5.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M8 9h8M8 12.5h5.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const EqIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} {...iconProps}>
    <path
      d="M6 4.5v15M12 4.5v15M18 4.5v15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="6" cy="14" r="2.15" fill="currentColor" />
    <circle cx="12" cy="8" r="2.15" fill="currentColor" />
    <circle cx="18" cy="11.5" r="2.15" fill="currentColor" />
  </svg>
);

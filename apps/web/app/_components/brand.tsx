import Link from 'next/link';

export function Brand({
  compact = false,
  href = '/',
  homeLogo = false,
}: {
  compact?: boolean;
  href?: string;
  homeLogo?: boolean;
}) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href={href}
      aria-label="swavii home"
    >
      <span className={`logoWordmark${homeLogo ? ' logoWordmarkHome' : ''}`}>swavii</span>
    </Link>
  );
}

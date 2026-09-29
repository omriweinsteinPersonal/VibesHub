import Link from 'next/link';

export function Brand({
  compact = false,
  href = '/',
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href={href}
      aria-label="swavii home"
    >
      <span className="logoWordmark">swavii</span>
    </Link>
  );
}

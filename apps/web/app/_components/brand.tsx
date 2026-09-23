import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href="/"
      aria-label="swavii home"
    >
      <span className="logoWordmark">swavii</span>
    </Link>
  );
}

import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href="/"
      aria-label="Swave home"
    >
      <span aria-hidden="true" className="logoMark">
        <span className="logoGlyph">S</span>
      </span>
      <span className="logoWordmark">Swave</span>
    </Link>
  );
}

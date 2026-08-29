import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href="/"
      aria-label="VibesHub home"
    >
      <span aria-hidden="true" className="logoMark">
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M12 2.75c.25 3.55 1.7 5 5.25 5.25-3.55.25-5 1.7-5.25 5.25C11.75 9.7 10.3 8.25 6.75 8 10.3 7.75 11.75 6.3 12 2.75Z" />
          <path d="M18.2 12.6c.14 2.03.97 2.86 3 3-2.03.14-2.86.97-3 3-.14-2.03-.97-2.86-3-3 2.03-.14 2.86-.97 3-3Z" />
          <path d="M6.1 13.65c.17 2.44 1.16 3.43 3.6 3.6-2.44.17-3.43 1.16-3.6 3.6-.17-2.44-1.16-3.43-3.6-3.6 2.44-.17 3.43-1.16 3.6-3.6Z" />
        </svg>
      </span>
      <span>VibesHub</span>
    </Link>
  );
}

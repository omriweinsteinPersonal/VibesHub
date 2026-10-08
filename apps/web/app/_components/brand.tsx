import Link from 'next/link';
import Image from 'next/image';

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
      <span className={`logoWordmark${homeLogo ? ' logoWordmarkHome' : ''}`}>
        {homeLogo ? (
          <Image
            src="/images/home/swavii-logo.png"
            alt="swavii"
            width={548}
            height={430}
          />
        ) : (
          'swavii'
        )}
      </span>
    </Link>
  );
}

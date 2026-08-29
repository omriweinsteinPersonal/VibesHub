import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={compact ? 'logo logoCompact' : 'logo'}
      href="/"
      aria-label="VibesHub home"
    >
      <span aria-hidden="true" className="logoMark">
        <Sparkles size={16} />
      </span>
      <span>VibesHub</span>
    </Link>
  );
}

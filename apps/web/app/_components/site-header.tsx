import Link from 'next/link';

import { Brand } from './brand';
import { GlobalSearch } from './global-search';

export function SiteHeader() {
  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <Brand />
        <nav aria-label="Primary navigation">
          <Link href="/creators">Creators</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="actions">
          <GlobalSearch />
          <Link className="loginLink" href="/auth?mode=login">
            Login
          </Link>
          <Link
            className="button primary joinCreatorLink"
            href="/auth?mode=signup&amp;role=creator"
          >
            Join as Creator
          </Link>
        </div>
      </div>
    </header>
  );
}

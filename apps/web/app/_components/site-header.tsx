import Link from 'next/link';

import { GlobalSearch } from './global-search';

export function SiteHeader() {
  return (
    <header className="siteHeader">
      <Link className="logo" href="/" aria-label="VibesHub home">
        <span aria-hidden="true">✣</span> VibesHub
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/creators">Creators</Link>
        <Link href="/discover">Discover</Link>
        <Link href="/#about">About</Link>
      </nav>
      <div className="actions">
        <GlobalSearch />
        <Link className="loginLink" href="/login">
          Login
        </Link>
        <Link className="button primary" href="/join">
          Join as Creator
        </Link>
      </div>
    </header>
  );
}

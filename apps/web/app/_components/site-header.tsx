import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="siteHeader">
      <Link className="logo" href="/" aria-label="VibesHub home">
        <span aria-hidden="true">✣</span> VibesHub
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/creators">Creators</Link>
        <Link href="/#products">Shoppers</Link>
        <Link href="/creators#categories">Categories</Link>
        <Link href="/#products">Trending</Link>
        <Link href="/#about">About</Link>
      </nav>
      <div className="actions">
        <Link href="/login">Login</Link>
        <Link className="button primary" href="/join">
          Join as Creator
        </Link>
      </div>
    </header>
  );
}

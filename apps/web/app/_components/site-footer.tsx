import Link from 'next/link';

import { Brand } from './brand';

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerBrand">
          <Brand compact />
          <p>
            The marketplace where Israeli creators share what they actually use — and
            shoppers buy with confidence.
          </p>
        </div>
        <div className="footerColumn">
          <h3>Discover</h3>
          <Link href="/creators">Creators</Link>
          <Link href="/discover">Discover</Link>
        </div>
        <div className="footerColumn">
          <h3>Community</h3>
          <Link href="/shoppers">For shoppers</Link>
          <Link href="/about">About us</Link>
        </div>
        <div className="footerColumn footerCreatorNote">
          <h3>Creators</h3>
          <p>Apply in five minutes and open your storefront today.</p>
        </div>
      </div>
      <div className="siteFooterBottom">
        <span>© 2026 VibesHub. Made in Tel Aviv.</span>
        <span>Authentic recommendations only.</span>
      </div>
    </footer>
  );
}

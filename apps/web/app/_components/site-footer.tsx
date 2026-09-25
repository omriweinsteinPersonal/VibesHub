import Link from 'next/link';

import { Brand } from './brand';

export function SiteFooter() {
  return (
    <footer className="siteFooter creatorMarketingFooter">
      <div className="siteFooterInner">
        <div className="footerBrand">
          <Brand compact />
          <p>Your recommendations, your style, one link your audience can always find.</p>
        </div>
        <div className="footerColumn">
          <h3>Product</h3>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#pricing">Pricing</Link>
        </div>
        <div className="footerColumn">
          <h3>Creators</h3>
          <Link href="/auth?mode=signup">Create your page</Link>
          <Link href="/auth?mode=login">Log in</Link>
        </div>
        <div className="footerColumn footerCreatorNote">
          <h3>Made for your audience</h3>
          <p>Every creator page is public and easy to open from any social bio.</p>
        </div>
      </div>
      <div className="siteFooterBottom">
        <span>© 2026 swavii. Made in Tel Aviv.</span>
        <span>Built for creators.</span>
      </div>
    </footer>
  );
}

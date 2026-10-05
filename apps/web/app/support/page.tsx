import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const metadata: Metadata = {
  description: 'Get help with your Swavii creator account or public storefront.',
  title: 'Support',
};

export default function SupportPage() {
  return (
    <div className="editorialPage">
      <SiteHeader />
      <main className="legalMain">
        <header className="legalHero">
          <p className="eyebrow">SUPPORT</p>
          <h1>How can we help?</h1>
          <p className="legalSummary">
            Tell us what happened and include the email address connected to your creator
            account. We&apos;ll help you get back to your storefront.
          </p>
        </header>

        <div className="legalContent">
          <section className="legalCallout">
            <h2>Contact Swavii</h2>
            <p>
              Email <a href="mailto:privacy@swavii.com">privacy@swavii.com</a> with a
              short description of the issue. Do not send your password, authentication
              codes or payment details.
            </p>
          </section>

          <section>
            <h2>Account access</h2>
            <p>
              If sign-in is not working, tell us whether you use email and password or
              Google sign-in, and attach a screenshot only if it does not contain private
              information.
            </p>
          </section>

          <section>
            <h2>Account deletion</h2>
            <p>
              Creators can permanently delete an account from Account settings in the app.
              If you cannot access the account, follow the instructions on our{' '}
              <Link href="/account-deletion">account deletion page</Link>.
            </p>
          </section>

          <section>
            <h2>Privacy and terms</h2>
            <p>
              Read our <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/terms">Terms of Service</Link> for more information about the
              service and how we handle data.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

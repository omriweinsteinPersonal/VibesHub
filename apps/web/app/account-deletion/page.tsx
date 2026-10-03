import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const metadata: Metadata = {
  description: 'Delete your Swavii creator account and associated data.',
  title: 'Delete your account',
};

export default function AccountDeletionPage() {
  return (
    <div className="editorialPage">
      <SiteHeader />
      <main className="legalMain">
        <header className="legalHero">
          <p className="eyebrow">ACCOUNT &amp; PRIVACY</p>
          <h1>Delete your account</h1>
          <p className="legalSummary">
            Swavii creator accounts and their associated data can be permanently deleted.
            Shoppers do not need or have Swavii accounts.
          </p>
        </header>

        <div className="legalContent">
          <section className="legalCallout">
            <h2>Delete from the app</h2>
            <p>
              Open Swavii, choose <strong>Account</strong>, then choose{' '}
              <strong>Delete account</strong> and confirm. This is the quickest option.
            </p>
          </section>

          <section>
            <h2>Request deletion without the app</h2>
            <p>
              If you no longer have access to the app, email{' '}
              <a href="mailto:privacy@swavii.com?subject=Swavii%20account%20deletion%20request">
                privacy@swavii.com
              </a>{' '}
              from the address used for your creator account. Use the subject “Swavii
              account deletion request.” We may ask you to verify control of the account
              before deletion to protect it from unauthorized requests.
            </p>
          </section>

          <section>
            <h2>What is deleted</h2>
            <p>
              Deletion removes the authentication account and creator-owned profile,
              storefront, recommendations, videos, discount codes and related account
              data. Unreferenced creator uploads are also scheduled for removal.
            </p>
            <p>
              Limited records may remain for a reasonable period in backups, security logs
              or where retention is required for legal, fraud-prevention, dispute or
              accounting purposes. See the <Link href="/privacy">Privacy Policy</Link> for
              details.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

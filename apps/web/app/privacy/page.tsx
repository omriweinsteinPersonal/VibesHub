import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const metadata: Metadata = {
  description:
    'How swavii collects, uses, stores and protects information about creators and storefront visitors.',
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="editorialPage">
      <SiteHeader />
      <main className="legalMain">
        <header className="legalHero">
          <p className="eyebrow">LEGAL</p>
          <h1>Privacy Policy</h1>
          <p className="legalSummary">
            This policy explains what information swavii handles when creators build a
            public recommendation page and when visitors browse those pages.
          </p>
          <p className="legalUpdated">Effective and last updated: September 30, 2026</p>
        </header>

        <div className="legalContent">
          <section className="legalCallout">
            <h2>The short version</h2>
            <p>
              Swavii accounts are for creators and platform operators. Shoppers do not
              need an account to view a creator&apos;s storefront. We use account data to
              operate creator pages and limited, privacy-conscious analytics to show
              creators how their public content performs. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2>1. Who this policy covers</h2>
            <p>
              This Privacy Policy applies to swavii&apos;s website, creator tools, public
              storefronts and related mobile applications and services (together, the
              “Service”). In this policy, “swavii,” “we,” “us” and “our” refer to the
              operator of the Service in Israel.
            </p>
            <p>
              Creators control the content they publish on their storefronts. Merchants
              and other websites linked from a storefront operate under their own privacy
              policies.
            </p>
          </section>

          <section>
            <h2>2. Information we collect</h2>
            <h3>Creator account information</h3>
            <ul>
              <li>
                Identity and sign-in data, such as name, email address, account ID and
                authentication provider. If you use Google sign-in, we receive the basic
                profile information you authorize Google to share for authentication.
              </li>
              <li>
                Creator application and profile data, including your chosen handle,
                biography, category, profile image and social links.
              </li>
              <li>
                Storefront content, including recommendations, reviews, product and brand
                details, images, videos, discount codes and related links.
              </li>
              <li>
                Communications, support requests, security records and actions taken in
                the creator dashboard.
              </li>
            </ul>

            <h3>Storefront visitor information</h3>
            <ul>
              <li>
                Basic request and device information needed to deliver and protect the
                Service, such as browser type, approximate region, request time and
                network information processed in security and server logs.
              </li>
              <li>
                Storefront activity, such as page and recommendation views, story opens
                and completions, discount-code copies, social-link taps and outbound shop
                clicks.
              </li>
              <li>
                Random session identifiers stored in the browser. Before analytics records
                are stored, these identifiers are transformed into keyed hashes. Raw IP
                addresses are used transiently for abuse prevention and are not written to
                analytics event records.
              </li>
            </ul>
            <p>
              Shoppers can browse public storefronts without creating an account, and we
              do not intentionally collect a shopper&apos;s name or email through ordinary
              storefront browsing.
            </p>
          </section>

          <section>
            <h2>3. How we use information</h2>
            <ul>
              <li>Authenticate creators and keep accounts secure.</li>
              <li>Create, publish and maintain creator storefronts.</li>
              <li>Process uploads, recommendations, links and discount codes.</li>
              <li>
                Provide creators with aggregated performance information about their own
                storefront and recommendations.
              </li>
              <li>Prevent fraud, abuse, security incidents and service disruption.</li>
              <li>Provide support, troubleshoot problems and improve the Service.</li>
              <li>Comply with applicable law and enforce our Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2>4. Public creator content</h2>
            <p>
              A creator&apos;s display name, handle, profile image, biography, social
              links, recommendations, reviews, media, discount codes and selected
              storefront design are intended to be public. Do not publish information you
              do not want visitors to see or share. Creator account credentials, private
              application details and unpublished dashboard information are not part of
              the public storefront.
            </p>
          </section>

          <section>
            <h2>5. When we share information</h2>
            <p>We may share information only as needed with:</p>
            <ul>
              <li>
                Infrastructure and service providers that host the Service, database,
                authentication, storage, security and sign-in functionality, including
                Vercel, Supabase and Google.
              </li>
              <li>
                Professional advisers or authorities when reasonably necessary to comply
                with law, protect rights and safety, or investigate abuse.
              </li>
              <li>
                A successor in connection with a merger, financing, acquisition or sale of
                all or part of the Service, subject to appropriate safeguards.
              </li>
            </ul>
            <p>
              We do not sell personal data. We do not share Google account data for
              advertising, and we use it only to authenticate and operate the creator
              account requested by the user.
            </p>
          </section>

          <section>
            <h2>6. Storage, cookies and international processing</h2>
            <p>
              We use essential cookies and browser storage to maintain creator sessions,
              remember security state and create short-lived analytics session
              identifiers. We do not currently use third-party advertising cookies.
            </p>
            <p>
              Our providers may process information in Israel, the European Economic Area,
              the United States and other locations where they operate. We use
              contractual, technical and organizational safeguards appropriate to the
              information and the Service.
            </p>
          </section>

          <section>
            <h2>7. Retention and account deletion</h2>
            <p>
              We retain creator information while the account is active and as needed to
              provide the Service. A creator can permanently delete the account from the
              account settings. A creator who no longer has access to the app can also use
              our public <Link href="/account-deletion">account deletion page</Link>.
              Deletion removes the authentication account and associated creator-owned
              profile and storefront data. Unreferenced creator uploads are also scheduled
              for removal.
            </p>
            <p>
              Limited records may remain for a reasonable period in backups, security logs
              or where retention is required for legal, fraud-prevention, dispute or
              accounting purposes. Shared catalog media may remain when it is lawfully
              used by another active record and no longer identifies the deleted account
              owner.
            </p>
          </section>

          <section>
            <h2>8. Your choices and rights</h2>
            <p>
              Creators can review and update profile and storefront information from their
              account, or delete the account from account settings. Depending on
              applicable law, you may also request access to, correction of or deletion of
              personal information, or object to certain processing.
            </p>
            <p>
              Storefront visitors can clear browser storage to reset local session
              identifiers. Because shopper analytics are not stored with a shopper account
              or direct identity, we may not be able to connect an anonymous event to a
              particular person without additional information.
            </p>
          </section>

          <section>
            <h2>9. Children</h2>
            <p>
              Creator accounts are intended for adults aged 18 or older. The Service is
              not directed to children, and we do not knowingly collect personal
              information from children through creator registration.
            </p>
          </section>

          <section>
            <h2>10. Changes and contact</h2>
            <p>
              We may update this policy as the Service changes. We will post the revised
              policy here and update the date above. If a change materially affects how we
              use creator information, we will provide an additional notice where
              appropriate.
            </p>
            <p>
              For privacy questions or requests, email{' '}
              <a href="mailto:privacy@swavii.com">privacy@swavii.com</a>. For the rules
              that govern use of the Service, read our{' '}
              <Link href="/terms">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

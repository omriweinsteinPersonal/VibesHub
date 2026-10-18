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
    <div className="editorialPage legalPage">
      <SiteHeader homeLogo />
      <main className="legalMain">
        <header className="legalHero">
          <p className="eyebrow">LEGAL</p>
          <h1>Privacy Policy</h1>
          <p className="legalSummary">
            This policy explains what information swavii handles when creators build a
            public recommendation page and when visitors browse those pages.
          </p>
          <p className="legalUpdated">Effective and last updated: October 17, 2026</p>
        </header>

        <div className="legalContent">
          <section className="legalCallout">
            <h2>The short version</h2>
            <p>
              Anyone may browse public storefronts, and shoppers do not need an account to
              view them. People of any age may use the Service, subject to applicable law.
              We use account data to operate creator pages and privacy-conscious analytics
              to show creators how their public content performs. We do not sell personal
              data.
            </p>
          </section>

          <section>
            <h2>1. Who this policy covers</h2>
            <p>
              This Privacy Policy applies to swavii&apos;s website, creator tools, public
              storefronts and related mobile applications and services (together, the
              “Service”). In this policy, “swavii,” “we,” “us” and “our” refer to the
              operator of the Service. We will publish the operator&apos;s formal legal
              name and registered contact details when they are finalized.
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
                authentication provider. If you use Google or Apple sign-in, we receive
                the basic profile and account information made available by that provider
                for authentication, which may include your name, email address, provider
                user ID and profile image.
              </li>
              <li>
                Creator application and profile data, including your chosen handle,
                biography, category, profile image and social links.
              </li>
              <li>
                Storefront content, including recommendations, reviews, product and brand
                details, images, videos, discount codes, social links, external links and
                other text or information you choose to publish. Do not publish passwords,
                financial information, medical information or another person&apos;s
                personal information without authorization.
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
                Service, such as browser type, device information, approximate region,
                request time, referrer information and network information processed in
                security and server logs.
              </li>
              <li>
                Storefront activity, such as page and recommendation views, story opens
                and completions, discount-code copies, social-link taps and outbound shop
                clicks.
              </li>
              <li>
                Random anonymous and session identifiers stored in browser storage. Before
                analytics records are stored, these identifiers are transformed into keyed
                hashes. Raw IP addresses may be processed transiently for rate limiting,
                abuse prevention and service security; they are not written to
                creator-facing analytics event records.
              </li>
            </ul>
            <p>
              Shoppers can browse public storefronts without creating an account, and we
              do not intentionally request a shopper&apos;s name or email through ordinary
              storefront browsing. A visitor may still provide information to a
              third-party destination after following a link from a storefront.
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
              <li>
                Send account, verification, password-reset, security and other service
                messages.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Public creator content</h2>
            <p>
              A creator&apos;s display name, handle, profile image, biography, social
              links, recommendations, reviews, media, discount codes, external links and
              selected storefront design are intended to be public. Public content may be
              viewed, shared, cached or indexed by search engines and may remain in copies
              made by other people after it is removed from Swavii. Do not publish
              information you do not want visitors to see or share. Creator account
              credentials, private application details and unpublished dashboard
              information are not part of the public storefront.
            </p>
          </section>

          <section>
            <h2>5. When we share information</h2>
            <p>We may share information only as needed with:</p>
            <ul>
              <li>
                Infrastructure and service providers that host the Service, database,
                authentication, storage, security and sign-in functionality, including
                Supabase, our hosting provider, Google and Apple where applicable.
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
              We do not sell personal data. We do not use Google or Apple account data for
              advertising, and we use it only to authenticate and operate the account
              requested by the user.
            </p>
          </section>

          <section>
            <h2>6. Storage, cookies and international processing</h2>
            <p>
              We use essential cookies and browser storage to maintain creator sessions,
              remember security state and create analytics identifiers. On the web, the
              anonymous analytics identifier is stored in local storage and the session
              identifier is stored in session storage. Authentication may also use cookies
              managed through Supabase. We do not currently use Google Analytics, Meta
              Pixel, TikTok Pixel or third-party advertising cookies in the Swavii web
              application.
            </p>
            <p>
              Creator images and videos are stored using Supabase Storage. Temporary
              upload authorization may expire after a short period, while published
              storefront media may remain publicly accessible as long as the related
              content is published. Public media may also be cached by browsers,
              content-delivery systems or other services.
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
              provide the Service. Account deletion is available through the mobile
              application and our public{' '}
              <Link href="/account-deletion">account deletion process</Link>. Deletion
              removes the authentication account and associated creator-owned profile,
              storefront, recommendations, videos, discount codes and other account data.
              Unreferenced creator uploads are removed from storage as part of the
              deletion process.
            </p>
            <p>
              Limited records may remain in analytics records, backups, security logs or
              where retention is required for legal, fraud-prevention, dispute or
              accounting purposes. Shared catalog media may remain when it is lawfully
              used by another active record and no longer identifies the deleted account
              owner. We are reviewing and will publish more specific retention periods as
              the Service and its operational processes are finalized.
            </p>
          </section>

          <section>
            <h2>8. Your choices and rights</h2>
            <p>
              Creators can review and update profile and storefront information from their
              account. Depending on applicable law, you may also request access to,
              correction of or deletion of personal information, request a copy of your
              information, or object to certain processing. To make a privacy request,
              contact us at the email address below. We may need to verify your identity
              before completing a request.
            </p>
            <p>
              Storefront visitors can clear browser storage to reset local session
              identifiers. Because shopper analytics are not stored with a shopper account
              or direct identity, we may not be able to connect an anonymous event to a
              particular person without additional information.
            </p>
          </section>

          <section>
            <h2>9. Children and users of all ages</h2>
            <p>
              Public storefronts and creator accounts are available to users of all ages,
              subject to applicable law. Swavii does not intentionally request age or date
              of birth during ordinary registration. Users should not publish passwords,
              financial information, medical information or other sensitive personal
              information in public storefront content or free-text fields.
            </p>
            <p>
              If a parent or guardian believes that a child provided personal information
              to Swavii, they should contact us at the email address below. We will review
              the request and take steps required by applicable law, including deletion
              where appropriate.
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
              We aim to respond to privacy requests within 30 days, or within any shorter
              period required by applicable law.
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

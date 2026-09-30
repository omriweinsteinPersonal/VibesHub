import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const metadata: Metadata = {
  description:
    'The terms that apply to creator accounts, public storefronts and use of swavii.',
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="editorialPage">
      <SiteHeader />
      <main className="legalMain">
        <header className="legalHero">
          <p className="eyebrow">LEGAL</p>
          <h1>Terms of Service</h1>
          <p className="legalSummary">
            These terms govern creator accounts, public storefronts and access to swavii.
            They are designed for a service where creators publish recommendations and
            shoppers browse without an account.
          </p>
          <p className="legalUpdated">Effective and last updated: September 30, 2026</p>
        </header>

        <div className="legalContent">
          <section className="legalCallout">
            <h2>Plain-language summary</h2>
            <p>
              Creator accounts are for adults. Creators remain responsible for what they
              publish and for clearly disclosing commercial relationships. Swavii provides
              the storefront and link tools; purchases happen with independent merchants,
              not with swavii.
            </p>
          </section>

          <section>
            <h2>1. Agreement to these terms</h2>
            <p>
              By creating an account, signing in or otherwise using the swavii website,
              creator tools, public storefronts or related applications (the “Service”),
              you agree to these Terms of Service and our{' '}
              <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use
              the Service.
            </p>
          </section>

          <section>
            <h2>2. Who may use swavii</h2>
            <p>
              Creator accounts are available only to people aged 18 or older who can enter
              into a binding agreement. If you use the Service for a business or another
              person, you confirm that you have authority to bind them to these terms.
            </p>
            <p>
              Shoppers and other visitors may browse public storefronts without creating
              an account. We may approve, reject, suspend or remove creator access when
              reasonably necessary to protect the Service or its users.
            </p>
          </section>

          <section>
            <h2>3. Accounts and security</h2>
            <ul>
              <li>Provide accurate information and keep it reasonably current.</li>
              <li>
                Keep your credentials secure and do not share access to your account.
              </li>
              <li>
                Tell us promptly if you believe your account or storefront has been
                compromised.
              </li>
              <li>
                You are responsible for activity performed through your account unless it
                results from our failure to use reasonable security measures.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Creator content and permissions</h2>
            <p>
              You keep ownership of the text, images, video and other material you submit
              (“Creator Content”). You grant swavii a worldwide, non-exclusive,
              royalty-free license to host, store, reproduce, adapt for technical display,
              distribute and publicly display Creator Content only as needed to operate,
              promote and improve the Service. This license ends when the content is
              deleted, except for reasonable backup periods and lawful uses that began
              before deletion.
            </p>
            <p>
              You confirm that you have the rights and permissions needed to publish your
              Creator Content, including product images, music, video, trademarks, reviews
              and links, and that your content does not violate another person&apos;s
              rights.
            </p>
          </section>

          <section>
            <h2>5. Recommendations and commercial disclosures</h2>
            <p>
              Recommendations must reflect your genuine experience or opinion. You are
              responsible for ensuring that product claims are accurate and not
              misleading, and for clearly disclosing affiliate, sponsored, gifted or other
              commercial relationships as required by applicable law and platform rules.
            </p>
            <p>
              Discount codes, prices, availability and merchant offers can change. Do not
              represent that swavii or a merchant guarantees a code or offer unless that
              is expressly confirmed in writing.
            </p>
          </section>

          <section>
            <h2>6. Purchases and third-party services</h2>
            <p>
              Swavii is a publishing and discovery service, not the seller or merchant of
              products shown on creator storefronts. When a visitor follows a product
              link, any purchase is made directly from the independent merchant under that
              merchant&apos;s terms, return policy and privacy policy. Swavii is not
              responsible for merchant inventory, delivery, product safety, warranties,
              refunds or customer service.
            </p>
            <p>
              The Service may link to social networks, merchants and other third parties.
              We do not control those services and are not responsible for their content
              or practices.
            </p>
          </section>

          <section>
            <h2>7. Acceptable use</h2>
            <p>You may not use the Service to:</p>
            <ul>
              <li>Break the law, infringe rights or mislead visitors.</li>
              <li>Publish unlawful, abusive, dangerous or fraudulent content.</li>
              <li>Upload malware or interfere with the Service or another account.</li>
              <li>
                Scrape, reverse engineer or access the Service through automated means
                except as permitted by us or applicable law.
              </li>
              <li>
                Evade security, moderation, rate limits or merchant-domain protections.
              </li>
              <li>Impersonate another person, creator, brand or merchant.</li>
            </ul>
          </section>

          <section>
            <h2>8. Service changes, suspension and deletion</h2>
            <p>
              We may improve, change or discontinue parts of the Service. We may remove
              content or suspend an account when we reasonably believe these terms, law or
              third-party rights have been violated, or when needed to protect users or
              the Service. Where appropriate, we will provide notice and an opportunity to
              address the issue.
            </p>
            <p>
              Creators may permanently delete their account from account settings. Account
              deletion removes the public creator page and associated creator-owned data
              as described in the <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2>9. Intellectual property</h2>
            <p>
              Swavii&apos;s software, design, branding and original content are owned by
              us or our licensors and are protected by applicable intellectual-property
              laws. These terms do not transfer ownership of the Service or permit use of
              the swavii name or branding outside ordinary use of the Service.
            </p>
          </section>

          <section>
            <h2>10. Disclaimers and liability</h2>
            <p>
              The Service is provided on an “as is” and “as available” basis. To the
              maximum extent permitted by law, we do not make warranties about
              uninterrupted availability, merchant products, creator claims, external
              links or particular commercial results.
            </p>
            <p>
              To the maximum extent permitted by law, swavii will not be liable for
              indirect, incidental, special, consequential or punitive damages, or for
              lost profits, revenue, data or goodwill arising from use of the Service.
              Nothing in these terms limits rights or liability that cannot lawfully be
              limited.
            </p>
          </section>

          <section>
            <h2>11. Governing law</h2>
            <p>
              These terms are governed by the laws of the State of Israel, without regard
              to conflict-of-law rules. Courts with jurisdiction in Tel Aviv–Jaffa,
              Israel, will have exclusive jurisdiction, except where applicable consumer
              law gives you the right to bring a claim elsewhere.
            </p>
          </section>

          <section>
            <h2>12. Changes and contact</h2>
            <p>
              We may update these terms as the Service changes. We will post the revised
              terms here and update the date above. Material changes may also be presented
              in the Service or sent to the account email where appropriate. Continued use
              after the new terms take effect means you accept them.
            </p>
            <p>
              Questions about these terms can be sent to{' '}
              <a href="mailto:privacy@swavii.com">privacy@swavii.com</a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Camera,
  Check,
  Grid2X2,
  Home,
  Link as LinkIcon,
  MapPinned,
  Play,
  Tag,
  UserRound,
} from 'lucide-react';
import { HomeGallery, HomeStudio } from './_components/home-experience';
import {
  organizationStructuredData,
  siteName,
  websiteStructuredData,
} from '../lib/site-metadata';
import styles from './home.module.css';

const signup = '/auth?mode=signup';
const description =
  'Swavii lets creators build a personal page that looks and feels like them—bringing together recommendations, collections, links, photos, videos and more in one place.';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description,
  openGraph: {
    description,
    siteName,
    title: siteName,
    type: 'website',
    url: '/',
  },
  title: siteName,
  twitter: { description, title: siteName },
};

export default function HomePage() {
  return (
    <div className={styles.page}>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([websiteStructuredData, organizationStructuredData]),
        }}
        type="application/ld+json"
      />
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label="Swavii home">
          <Image
            src="/images/home/swavii-logo.png"
            alt="swavii"
            width={548}
            height={430}
            priority
          />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/auth?mode=login">Log in</Link>
        </div>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title">
              Your World,
              <br />
              curated in one place.
            </h1>
            <p>One link-in-bio for everything you want to share.</p>
            <form action="/auth" className={styles.signup}>
              <input type="hidden" name="mode" value="signup" />
              <label className={styles.srOnly} htmlFor="creator-name">
                Choose your page name (optional)
              </label>
              <div className={styles.signupRow}>
                <div className={styles.nameField}>
                  <span>swavii.com/</span>
                  <input
                    id="creator-name"
                    name="name"
                    placeholder="yourname"
                    aria-label="Your name (optional)"
                    autoComplete="given-name"
                    maxLength={50}
                  />
                </div>
                <button className={styles.button} type="submit">
                  Start your page
                </button>
              </div>
            </form>
          </div>
          <HomeGallery />
        </section>
        <section
          className={styles.contentTypes}
          id="features"
          aria-labelledby="content-title"
        >
          <div className={styles.contentHeading}>
            <div>
              <span className={styles.contentEyebrow}>BUILD YOUR PAGE</span>
              <h2 id="content-title">Everything you love, in one place.</h2>
              <p>Choose the pieces that make your page feel like you.</p>
            </div>
            <a href="#how-it-works">
              See how it works <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.contentGrid}>
            <article className={`${styles.contentBlock} ${styles.linkBlock}`}>
              <div className={styles.featureVisual}>
                <LinkIcon aria-hidden="true" />
              </div>
              <div className={styles.featureCopy}>
                <h3>Custom link</h3>
                <p>Share anything with a link made for you.</p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.mediaBlock}`}>
              <div className={styles.featureMediaPreview} aria-hidden="true">
                <Image
                  src="/images/home/kitchen-collection.jpg"
                  alt=""
                  fill
                  sizes="96px"
                />
                <Image src="/images/home/coffee.jpg" alt="" width={58} height={46} />
                <span>
                  <Play size={12} fill="currentColor" />
                </span>
              </div>
              <div className={styles.featureCopy}>
                <h3>Media</h3>
                <p>Showcase your photos and videos.</p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.socialBlock}`}>
              <div className={styles.featureSocialPreview} aria-hidden="true">
                {['instagram', 'tiktok', 'youtube'].map((name) => (
                  <span key={name}>
                    <Image
                      src={`/connectors/${name}.svg`}
                      alt=""
                      width={17}
                      height={17}
                    />
                  </span>
                ))}
                <span className={styles.socialPlus}>+</span>
              </div>
              <div className={styles.featureCopy}>
                <h3>Social links</h3>
                <p>Bring all your social profiles together.</p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.collectionBlock}`}>
              <div className={styles.featureCollectionPreview} aria-hidden="true">
                <Image src="/images/home/tote.jpg" alt="" fill sizes="92px" />
                <Image
                  src="/images/creator-demo-shoulder-bag.png"
                  alt=""
                  width={62}
                  height={52}
                />
              </div>
              <div className={styles.featureCopy}>
                <h3>Collection</h3>
                <p>Group your links, media and more.</p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.designBlock}`}>
              <div className={styles.featureDesignPreview} aria-hidden="true">
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <Image src="/images/home/miya.jpg" alt="" fill sizes="92px" />
                <span>
                  <b />
                  <b />
                  <b />
                </span>
              </div>
              <div className={styles.featureCopy}>
                <h3>Personal design</h3>
                <p>Make it yours with custom styles.</p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.mapsBlock}`}>
              <div className={styles.featureMapPreview} aria-hidden="true">
                <i />
                <i />
                <i />
                <MapPinned size={27} />
              </div>
              <div className={styles.featureCopy}>
                <h3>Maps</h3>
                <p>Share your location with ease.</p>
              </div>
            </article>
          </div>
        </section>
        <section
          className={styles.studioSection}
          id="how-it-works"
          aria-labelledby="studio-title"
        >
          <div className={styles.split}>
            <div className={styles.sectionCopy}>
              <h2 id="studio-title">
                Make it yours,
                <br />
                one detail at a time.
              </h2>
              <p>
                A simple, powerful editor to build a page that feels like you — no tech
                skills needed.
              </p>
              <ol className={styles.studioSteps}>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Add content</strong>
                    <small>Links, photos, videos, collections and more.</small>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Arrange sections</strong>
                    <small>Drag, drop and reorder.</small>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Style your page</strong>
                    <small>Choose colors, fonts and a look that fits you.</small>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <strong>Share it</strong>
                    <small>Get your link and start sharing everywhere.</small>
                  </div>
                </li>
              </ol>
            </div>
            <HomeStudio />
          </div>
        </section>
        <section
          className={`${styles.split} ${styles.analyticsSection}`}
          aria-labelledby="analytics-title"
        >
          <div className={styles.sectionCopy}>
            <h2 id="analytics-title">See what your audience comes back for.</h2>
            <p>Track page views, content clicks, and the collections people explore.</p>
          </div>
          <div
            className={styles.analytics}
            aria-label="Illustrative analytics dashboard, not actual customer results"
          >
            <div className={styles.metrics}>
              {[
                ['Page views', '12.4K'],
                ['Content clicks', '3.1K'],
                ['Collection views', '842'],
                ['Top collection', 'Everyday essentials'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className={styles.analyticsPanels}>
              <div className={styles.chart}>
                <h3>Page views</h3>
                <svg
                  viewBox="0 0 460 190"
                  role="img"
                  aria-label="Example monthly page views rise from 110 in January to 540 in December"
                >
                  {[30, 75, 120, 165].map((y, i) => (
                    <g key={y}>
                      <line x1="34" y1={y} x2="450" y2={y} stroke="#e7e3df" />
                      <text x="0" y={y + 4} fontSize="11" fill="#6b6e6b">
                        {600 - i * 200}
                      </text>
                    </g>
                  ))}
                  <path
                    d="M34 140 L72 118 L110 132 L148 119 L186 101 L224 90 L262 100 L300 102 L338 75 L376 66 L414 59 L450 43 L450 165 L34 165Z"
                    fill="#83454b"
                    fillOpacity=".12"
                  />
                  <path
                    d="M34 140 L72 118 L110 132 L148 119 L186 101 L224 90 L262 100 L300 102 L338 75 L376 66 L414 59 L450 43"
                    fill="none"
                    stroke="#83454b"
                    strokeWidth="2.5"
                  />
                  {[
                    [34, 140],
                    [72, 118],
                    [110, 132],
                    [148, 119],
                    [186, 101],
                    [224, 90],
                    [262, 100],
                    [300, 102],
                    [338, 75],
                    [376, 66],
                    [414, 59],
                    [450, 43],
                  ].map(([x, y]) => (
                    <circle key={x} cx={x} cy={y} r="3.5" fill="#83454b" />
                  ))}
                  <text x="34" y="186" fontSize="11" fill="#6b6e6b">
                    Jan
                  </text>
                  <text x="220" y="186" fontSize="11" fill="#6b6e6b">
                    Jun
                  </text>
                  <text x="432" y="186" fontSize="11" fill="#6b6e6b">
                    Dec
                  </text>
                </svg>
              </div>
              <div className={styles.topPicks}>
                <h3>Top recommendations</h3>
                {(
                  [
                    ['/images/creator-demo-shoulder-bag.png', 'Everyday bag', '1.2K'],
                    ['/images/creator-demo-coffee-cup.png', 'Ceramic mug', '842'],
                    ['/images/home/camera.jpg', 'Compact camera', '624'],
                  ] as const
                ).map(([src, name, count], i) => (
                  <div key={name}>
                    <span>{i + 1}</span>
                    <Image src={src} alt="" width={34} height={40} />
                    <span>{name}</span>
                    <small>{count}</small>
                  </div>
                ))}
              </div>
            </div>
            <p className={styles.dataNote}>Illustrative data</p>
          </div>
        </section>
        <section
          className={styles.pricingSection}
          id="pricing"
          aria-labelledby="pricing-title"
        >
          <div className={styles.pricingInner}>
            <div className={styles.pricingIntro}>
              <h2 id="pricing-title">One simple plan.</h2>
              <p>Everything you need to create, share and grow.</p>
            </div>
            <div className={styles.priceCard}>
              <div className={styles.price}>
                <h3>First month free</h3>
                <p>Then $12 / month</p>
              </div>
              <ul>
                {[
                  'Your own Swavii page',
                  'All content types',
                  'Analytics',
                  'Update anytime',
                ].map((item) => (
                  <li key={item}>
                    <Check size={15} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link className={styles.button} href={signup}>
                Start your page
              </Link>
            </div>
          </div>
        </section>
        <section className={styles.instagram} aria-labelledby="instagram-title">
          <div>
            <h2 id="instagram-title">Make room for all of it.</h2>
            <p>
              Your creativity. Your work. Your favorite things.
              <br />
              All in one place.
            </p>
            <Link className={styles.button} href={signup}>
              Start your page
            </Link>
          </div>
          <div className={styles.closingPhotos} aria-hidden="true">
            {[
              '/images/home/daniel.jpg',
              '/images/home/maren-v2.jpg',
              '/images/home/bowl.jpg',
              '/images/home/miya.jpg',
            ].map((src) => (
              <Image key={src} src={src} alt="" width={120} height={145} />
            ))}
          </div>
          <a href="https://www.instagram.com/swavii_/" target="_blank" rel="noreferrer">
            <Camera size={20} aria-hidden="true" />{' '}
            <span data-nosnippet>Follow us on Instagram @swavii_</span>
            <span className={styles.srOnly}> (opens in a new tab)</span>
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link className={styles.wordmark} href="/">
          <Image
            src="/images/home/swavii-logo.png"
            alt="swavii"
            width={548}
            height={430}
          />
        </Link>
        <div data-nosnippet className={styles.footerNoSnippet}>
          <nav aria-label="Footer navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <small>
          <span data-nosnippet>© 2026 Swavii. All rights reserved.</span>
        </small>
      </footer>
      <nav className={styles.mobileFooter} aria-label="Mobile navigation">
        <a href="#main" aria-current="page">
          <Home size={21} aria-hidden="true" />
          Home
        </a>
        <a href="#features">
          <Grid2X2 size={21} aria-hidden="true" />
          Features
        </a>
        <a href="#pricing">
          <Tag size={21} aria-hidden="true" />
          Pricing
        </a>
        <Link href="/auth?mode=login">
          <UserRound size={21} aria-hidden="true" />
          Creator login
        </Link>
      </nav>
    </div>
  );
}

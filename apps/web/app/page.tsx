import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Check,
  Grid2X2,
  Home,
  Image as ImageIcon,
  Link as LinkIcon,
  Play,
  Tag,
  UserRound,
  Video,
} from 'lucide-react';
import { HomeGallery, HomeStudio } from './_components/home-experience';
import styles from './home.module.css';

const signup = '/auth?mode=signup';

export default function HomePage() {
  return (
    <div className={styles.page}>
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
          <Link href="/auth?mode=login">Creator log in</Link>
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
            <p>One page for everything you want to share.</p>
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
              <h2 id="content-title">More than a list of things you love.</h2>
              <p>
                Share your links, photos, videos, collections, Instagram and more — all in
                one beautiful page.
              </p>
            </div>
            <a href="#how-it-works">
              See how it works <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.contentGrid}>
            <article className={`${styles.contentBlock} ${styles.linkBlock}`}>
              <h3>
                <LinkIcon size={18} aria-hidden="true" /> Custom link
              </h3>
              <div className={styles.sampleLink}>
                <LinkIcon size={18} aria-hidden="true" /> My camera gear{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.galleryBlock}`}>
              <h3>
                <ImageIcon size={18} aria-hidden="true" /> Photo gallery
              </h3>
              <div className={styles.samplePhotos}>
                {[
                  '/images/home/daniel.jpg',
                  '/images/home/chair-final.jpg',
                  '/images/home/coffee.jpg',
                  '/images/home/miya.jpg',
                ].map((src, i) => (
                  <Image
                    key={src}
                    src={src}
                    alt={
                      [
                        'Photographer outdoors',
                        'Design chair',
                        'Coffee detail',
                        'Creator in her kitchen',
                      ][i] ?? 'Creator gallery photo'
                    }
                    width={124}
                    height={104}
                  />
                ))}
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.videoBlock}`}>
              <h3>
                <Video size={18} aria-hidden="true" /> Video
              </h3>
              <div className={styles.sampleVideo}>
                <Image
                  src="/images/home/kitchen-collection.jpg"
                  alt="Editorial kitchen scene"
                  fill
                  sizes="400px"
                />
                <Play size={29} fill="currentColor" aria-hidden="true" />
                <span>A day in the studio</span>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.postBlock}`}>
              <h3>
                <Camera size={18} aria-hidden="true" /> Instagram post
              </h3>
              <div className={styles.samplePost}>
                <Image
                  src="/images/home/fashion-collection.jpg"
                  alt="Wardrobe editorial"
                  width={160}
                  height={126}
                />
                <p>
                  A few good pieces, on repeat.<small>Like · Comment · Share</small>
                </p>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.collectionBlock}`}>
              <h3>
                <Grid2X2 size={18} aria-hidden="true" /> Collection
              </h3>
              <div className={styles.sampleCollection}>
                <strong>
                  The Everyday Edit <ArrowRight size={16} aria-hidden="true" />
                </strong>
                <div>
                  {[
                    '/images/creator-demo-shoulder-bag.png',
                    '/images/creator-demo-sneakers.png',
                    '/images/home/tote.jpg',
                  ].map((src) => (
                    <Image key={src} src={src} alt="" width={90} height={76} />
                  ))}
                </div>
              </div>
            </article>
            <article className={`${styles.contentBlock} ${styles.recommendationBlock}`}>
              <h3>
                <Tag size={18} aria-hidden="true" /> Recommendation
              </h3>
              <div className={styles.sampleRecommendation}>
                <Image
                  src="/images/home/camera-v2.jpg"
                  alt="Recommended camera"
                  width={105}
                  height={122}
                />
                <p>
                  <strong>A camera to take everywhere.</strong>
                  <span>One of Daniel’s everyday favorites.</span>
                </p>
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
            <Camera size={20} aria-hidden="true" /> Follow us on Instagram @swavii_
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
        <nav aria-label="Footer navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <small>© 2026 Swavii. All rights reserved.</small>
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

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ExternalLink,
  Grid2X2,
  GripVertical,
  Headphones,
  Link as LinkIcon,
  MapPin,
  Play,
  Video,
} from 'lucide-react';
import styles from '../home.module.css';

const assets = {
  bag: '/images/creator-demo-shoulder-bag.png',
  shoes: '/images/creator-demo-sneakers.png',
  mug: '/images/creator-demo-coffee-cup.png',
  camera: '/images/home/camera-v2.jpg',
  lamp: '/images/home/lamp-v2.jpg',
  chair: '/images/home/chair-final.jpg',
  coffee: '/images/home/coffee.jpg',
  pour: '/images/home/pourover.jpg',
  tote: '/images/home/tote.jpg',
  bowl: '/images/home/bowl.jpg',
  fashionCollection: '/images/home/fashion-collection.jpg',
  kitchenCollection: '/images/home/kitchen-collection.jpg',
  rotemDressNeutral: '/images/home/rotem-dress-v2.png',
  rotemJeansNeutral: '/images/home/rotem-jeans-v2.png',
  rotemBagNeutral: '/images/home/rotem-bag-v2.png',
  rotemSunglassesNeutral: '/images/home/rotem-sunglasses-v2.png',
  noahBoots: '/images/home/noah-boots.png',
  noahPack: '/images/home/noah-pack.png',
  noahTote: '/images/home/noah-tote.png',
  noahMug: '/images/home/noah-mug.png',
};
type Product = { name: string; image: string };
type BrandRecommendation = {
  brand: string;
  discount: string;
  code: string;
  expires: string;
  products: Product[];
};
type CreatorMedia =
  | { type: 'video'; title: string; detail: string; image: string }
  | { type: 'podcast'; title: string; detail: string; image: string }
  | { type: 'map'; title: string; location: string; detail: string };
type CreatorExample = {
  name: string;
  handle: string;
  details: string;
  bio: string;
  image: string;
  theme: string;
  background: string;
  ink: string;
  labels: string[];
  recommendations: BrandRecommendation[];
  media: CreatorMedia;
};

const creators: CreatorExample[] = [
  {
    name: 'Rotem Cohen',
    handle: 'rotemcohen',
    details: 'Style · Everyday · Finds',
    bio: '',
    image: '/images/home/rotem-profile-v3.png',
    theme: 'rotem',
    background: '#d99a78',
    ink: '#173c38',
    labels: ['All', 'Fashion', 'Sports', 'Random', 'Favs'],
    recommendations: [
      {
        brand: 'Vela Thread',
        discount: '20% off',
        code: 'Rotem20',
        expires: '17/10/2026',
        products: [
          { name: 'Softline Dress', image: assets.rotemDressNeutral },
          { name: 'Daylight Denim', image: assets.rotemJeansNeutral },
        ],
      },
      {
        brand: 'Morrow Edit',
        discount: '15% off',
        code: 'Morrow15',
        expires: '24/10/2026',
        products: [
          { name: 'Luna Structured Bag', image: assets.rotemBagNeutral },
          { name: 'Dune Sunglasses', image: assets.rotemSunglassesNeutral },
        ],
      },
    ],
    media: {
      type: 'video',
      title: "Rotem Cohen's Style Notes",
      detail: 'A few favorite looks · 8 min',
      image: '/images/home/rotem-style-notes-v3.png',
    },
  },
  {
    name: 'Mia Chen',
    handle: 'miachen',
    details: '',
    bio: 'Small rituals and thoughtful pieces for home.',
    image: '/images/home/miya.jpg',
    theme: 'mia',
    background: '#a9b6a0',
    ink: '#243e36',
    labels: ['All', 'Home', 'Coffee', 'Lifestyle', 'Favs'],
    recommendations: [
      {
        brand: 'Cedar & Steam',
        discount: '20% off',
        code: 'Mia20',
        expires: '25/11/2026',
        products: [
          { name: 'Slow Pour Kettle', image: assets.pour },
          { name: 'Sunday Cup Set', image: assets.mug },
        ],
      },
      {
        brand: 'Quiet Kiln',
        discount: '15% off',
        code: 'Kiln15',
        expires: '02/12/2026',
        products: [
          { name: 'Hearth Bowl', image: assets.bowl },
          { name: 'Evening Lamp', image: assets.lamp },
        ],
      },
    ],
    media: {
      type: 'podcast',
      title: 'A Slower Morning',
      detail: 'A gentle start to the day · 28 min',
      image: assets.coffee,
    },
  },
  {
    name: 'Noah Carter',
    handle: 'noahcarter',
    details: '',
    bio: 'Places worth the walk, and the gear I take along.',
    image: '/images/home/noah-trail-demo.png',
    theme: 'noah',
    background: '#68899b',
    ink: '#f8f6ef',
    labels: ['All', 'Outdoors', 'Travel', 'Gear', 'Favs'],
    recommendations: [
      {
        brand: 'Northpath Supply',
        discount: '25% off',
        code: 'Noah25',
        expires: '31/12/2026',
        products: [
          { name: 'Ridge Hiker', image: assets.noahBoots },
          { name: 'Waypoint Pack', image: assets.noahPack },
        ],
      },
      {
        brand: 'Summit Field',
        discount: '20% off',
        code: 'Summit20',
        expires: '10/01/2027',
        products: [
          { name: 'Trail Tote', image: assets.noahTote },
          { name: 'Camp Mug', image: assets.noahMug },
        ],
      },
    ],
    media: {
      type: 'map',
      title: 'Alpine Lake Loop',
      location: 'Dolomites',
      detail: 'A quiet route with a lakeside stop.',
    },
  },
];

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className={styles.productGrid}>
      {products.map((product) => (
        <div key={product.name}>
          <div className={styles.productPhoto}>
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 600px) 140px, 180px"
            />
          </div>
          <span>{product.name}</span>
        </div>
      ))}
    </div>
  );
}

function BrandRecommendation({
  recommendation,
}: {
  recommendation: BrandRecommendation;
}) {
  return (
    <article className={styles.brandRecommendation}>
      <div className={styles.brandRecommendationHeader}>
        <strong>{recommendation.brand}</strong>
        <div>
          <span>{recommendation.discount}</span>
          <small>{recommendation.code}</small>
        </div>
      </div>
      <p>Discount expires {recommendation.expires}</p>
      <ProductGrid products={recommendation.products} />
    </article>
  );
}

function CreatorMediaPreview({ media }: { media: CreatorMedia }) {
  if (media.type === 'map') {
    return (
      <article
        className={styles.mapRecommendation}
        aria-label={`${media.title}, ${media.location}`}
      >
        <div className={styles.mapRecommendationHeading}>
          <div>
            <MapPin size={14} aria-hidden="true" />
            <strong>{media.title}</strong>
          </div>
          <span>{media.location}</span>
        </div>
        <div className={styles.mapArtwork} aria-hidden="true">
          <svg viewBox="0 0 360 100" preserveAspectRatio="none">
            <path d="M-12 72C32 58 24 27 75 34s51 52 92 34 46-48 91-32 55 12 114-10" />
            <path d="M-8 88c44-18 54-2 84-16s37-55 82-48 41 53 87 42 61-32 127-17" />
            <path d="M22-8c19 28 3 56 26 75s58 10 80 38M169-6c-6 28 22 37 16 67s-31 32-20 49M286-10c-28 33-8 53 7 68s4 31-7 47" />
            <path
              className={styles.mapRoute}
              d="M46 60c35-17 44 12 77 2s31-31 68-20 38 28 71 13 33-20 58-11"
            />
          </svg>
          <MapPin
            className={styles.mapMarker}
            size={20}
            fill="currentColor"
            aria-hidden="true"
          />
        </div>
        <div className={styles.mapRecommendationFooter}>
          <small>{media.detail}</small>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${media.title}, ${media.location}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </article>
    );
  }

  if (media.type === 'podcast') {
    return (
      <article className={styles.podcastPreview}>
        <Image src={media.image} alt="" fill sizes="80px" />
        <div className={styles.podcastCopy}>
          <small>
            <Headphones size={12} aria-hidden="true" /> PODCAST
          </small>
          <strong>{media.title}</strong>
          <span>{media.detail}</span>
          <div className={styles.audioProgress} aria-hidden="true">
            <i />
          </div>
        </div>
        <span className={styles.mediaPlay} aria-hidden="true">
          <Play size={15} fill="currentColor" />
        </span>
      </article>
    );
  }

  return (
    <article className={styles.creatorVideoPreview}>
      <Image src={media.image} alt="" fill sizes="(max-width: 760px) 320px, 340px" />
      <div className={styles.videoScrim} />
      <span className={styles.mediaPlay} aria-hidden="true">
        <Play size={17} fill="currentColor" />
      </span>
      <div className={styles.creatorVideoCopy}>
        <small className={styles.youtubeBadge}>YouTube</small>
        <strong>{media.title}</strong>
        <small>{media.detail}</small>
      </div>
    </article>
  );
}

function CreatorCard({ index }: { index: number }) {
  const creator = creators[index] ?? creators[0]!;
  return (
    <article
      className={styles.creatorCard}
      data-theme={creator.theme}
      aria-label={`${creator.name}, example creator page`}
      style={
        {
          '--creator-background': creator.background,
          '--creator-ink': creator.ink,
        } as CSSProperties
      }
    >
      <div className={styles.cover}>
        <Image src={creator.image} alt="" fill sizes="(max-width: 760px) 320px, 360px" />
      </div>
      <div className={styles.identity}>
        <strong>{creator.name}</strong>
        {creator.details ? <span>{creator.details}</span> : null}
      </div>
      {creator.bio ? <p className={styles.creatorBio}>{creator.bio}</p> : null}
      <div className={styles.socialIcons} aria-label="Social platforms preview">
        <Image src="/connectors/youtube.svg" alt="" width={16} height={16} />
        <Image src="/connectors/pinterest.svg" alt="" width={16} height={16} />
        <Image src="/connectors/tiktok.svg" alt="" width={16} height={16} />
        <Image src="/connectors/instagram.svg" alt="" width={16} height={16} />
        <LinkIcon size={15} aria-hidden="true" />
      </div>
      <div className={styles.cardTabs} aria-hidden="true">
        {creator.labels.map((item, itemIndex) => (
          <span className={itemIndex === 0 ? styles.activeLabel : ''} key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className={styles.cardFeed}>
        {creator.recommendations.map((recommendation) => (
          <BrandRecommendation
            key={recommendation.brand}
            recommendation={recommendation}
          />
        ))}
        <CreatorMediaPreview media={creator.media} />
      </div>
    </article>
  );
}

export function HomeGallery() {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  function select(index: number) {
    const target = rail.current?.children[index] as HTMLElement | undefined;
    if (target && rail.current)
      rail.current.scrollTo({
        left: target.offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  return (
    <div className={styles.gallery}>
      <div
        className={styles.creatorRail}
        ref={rail}
        onScroll={() => {
          const element = rail.current;
          if (element && element.scrollWidth > element.clientWidth)
            setActive(
              Math.round(
                element.scrollLeft /
                  ((element.firstElementChild as HTMLElement).offsetWidth + 16),
              ),
            );
        }}
      >
        {creators.map((creator, index) => (
          <CreatorCard key={creator.handle} index={index} />
        ))}
      </div>
      <div className={styles.galleryBottom}>
        <small>Examples of pages you can make your own.</small>
        <div
          className={styles.galleryControls}
          aria-label="Choose an example creator page"
        >
          {creators.map((creator, index) => (
            <button
              key={creator.handle}
              type="button"
              aria-label={`Show ${creator.name}'s page`}
              aria-pressed={active === index}
              onClick={() => select(index)}
            >
              <span />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const steps = ['Add content', 'Arrange sections', 'Style your page', 'Share it'];

const studioPalettes = [
  {
    name: 'Deep slate',
    hero: '#263c48',
    surface: '#f5f4f0',
    accent: '#cb7955',
    ink: '#ffffff',
  },
  {
    name: 'Warm wine',
    hero: '#793e44',
    surface: '#fcf4ed',
    accent: '#ca8466',
    ink: '#ffffff',
  },
  {
    name: 'Soft sage',
    hero: '#5f7569',
    surface: '#f3f5ee',
    accent: '#c89e69',
    ink: '#ffffff',
  },
  {
    name: 'Sandstone',
    hero: '#bca68d',
    surface: '#faf7f1',
    accent: '#6a5345',
    ink: '#211c19',
  },
] as const;

function StudioMiniPreview({
  step,
  paletteIndex,
}: {
  step: number;
  paletteIndex: number;
}) {
  const palette = studioPalettes[paletteIndex] ?? studioPalettes[0];
  return (
    <div
      className={styles.miniStorefront}
      data-palette={palette.name}
      aria-label={`Live example creator page preview in ${palette.name} colors`}
      style={
        {
          '--mini-hero': palette.hero,
          '--mini-surface': palette.surface,
          '--mini-accent': palette.accent,
          '--mini-ink': palette.ink,
        } as CSSProperties
      }
    >
      <div className={styles.miniStatus} aria-hidden="true">
        <span>9:41</span>
        <span>●●● ▰</span>
      </div>
      <div className={styles.miniAddress}>
        swavii.com/alexrivers <span>↗</span>
      </div>
      <div className={styles.miniProfile}>
        <Image
          className={styles.miniAvatar}
          src="/images/home/daniel.jpg"
          alt=""
          width={52}
          height={52}
        />
        <div>
          <strong>Alex Rivers</strong>
          <small>Photography · spaces · the everyday</small>
        </div>
      </div>
      <p className={styles.miniBio}>
        A small corner for the places, objects and ideas I keep coming back to.
      </p>
      <div className={styles.miniSocial} aria-hidden="true">
        <Camera size={14} />
        <Video size={14} />
        <LinkIcon size={14} />
      </div>
      <div className={styles.miniTabs}>
        <span>Discover</span>
        <span>Collections</span>
        <span>Watch</span>
        <span>Links</span>
      </div>
      <div className={styles.miniFeed}>
        <div className={styles.miniIntro}>
          <span>THE PERSONAL EDIT</span>
          <strong>Things worth sharing.</strong>
          <small>Collected with intention, shared in one place.</small>
        </div>
        <div className={styles.miniCollection}>
          <div className={styles.miniCollectionCopy}>
            <span>COLLECTION / 08 PICKS</span>
            <strong>The everyday edit</strong>
            <small>Good pieces for good days.</small>
          </div>
          <Image
            src={assets.tote}
            alt="Canvas tote from the example collection"
            width={102}
            height={102}
          />
        </div>
        <div className={styles.miniVideo}>
          <Image
            src="/images/home/kitchen-collection.jpg"
            alt="A cinematic kitchen scene"
            fill
            sizes="320px"
          />
          <span className={styles.miniPlay}>
            <Play size={16} fill="currentColor" aria-hidden="true" />
          </span>
          <div>
            <small>WATCH / 00:42</small>
            <strong>A slow morning at home</strong>
          </div>
        </div>
        <div className={styles.miniRecommendations}>
          <div className={styles.miniRecommendationsTitle}>
            <strong>Selected favorites</strong>
            <span>See all ↗</span>
          </div>
          <div className={styles.miniProducts}>
            <div>
              <Image src={assets.camera} alt="Compact camera" width={105} height={90} />
              <span>Compact camera</span>
            </div>
            <div>
              <Image src={assets.mug} alt="Ceramic mug" width={105} height={90} />
              <span>Ceramic mug</span>
            </div>
          </div>
        </div>
        {step >= 1 ? (
          <div className={styles.miniEndnote}>More of Alex&apos;s world ↓</div>
        ) : null}
      </div>
      <span className={styles.miniHomeIndicator} aria-hidden="true" />
    </div>
  );
}

export function HomeStudio() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () =>
      setRunning(visible && !reduced.matches && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        update();
      },
      { threshold: 0.35 },
    );
    if (container.current) observer.observe(container.current);
    reduced.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      reduced.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setStep((current) => (current + 1) % steps.length),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [step, cycle, running]);
  useEffect(() => {
    if (step !== 2 || !running) return;
    const timer = window.setInterval(
      () => setPaletteIndex((current) => (current + 1) % studioPalettes.length),
      1400,
    );
    return () => window.clearInterval(timer);
  }, [step, running]);
  function choose(value: number) {
    setStep((value + steps.length) % steps.length);
    setCycle((current) => current + 1);
  }

  return (
    <div className={styles.studio} ref={container}>
      <div className={styles.studioCanvas} data-step={step}>
        <div className={styles.demoEditor} key={step}>
          <div className={styles.editorChrome}>
            <strong>swavii</strong>
            <span>Preview</span>
          </div>
          <div className={styles.editorTitle}>
            <h3>{steps[step]}</h3>
            <span>{step + 1} / 4</span>
          </div>
          {step === 0 && (
            <div className={styles.editorShowcase}>
              <p>Choose what belongs on your page.</p>
              <div className={styles.editorAddList}>
                <div>
                  <span>
                    <LinkIcon size={17} />
                  </span>
                  <strong>Custom link</strong>
                  <small>Send people anywhere</small>
                </div>
                <div>
                  <span>
                    <Camera size={17} />
                  </span>
                  <strong>Photo gallery</strong>
                  <small>Show the moments</small>
                </div>
                <div>
                  <span>
                    <Video size={17} />
                  </span>
                  <strong>Video</strong>
                  <small>Bring it to life</small>
                </div>
                <div>
                  <span>
                    <Grid2X2 size={17} />
                  </span>
                  <strong>Collection</strong>
                  <small>Curate it together</small>
                </div>
              </div>
              <small>Plus Instagram posts, recommendations and more.</small>
            </div>
          )}
          {step === 1 && (
            <div className={styles.editorShowcase}>
              <p>Put your story in the order that feels right.</p>
              <div className={styles.editorArrangeList}>
                {[
                  ['About me', 'The introduction'],
                  ['The everyday edit', 'Collection'],
                  ['A slow morning', 'Video'],
                  ['My favorite places', 'Links'],
                ].map(([name, detail], index) => (
                  <div key={name} className={index === 1 ? styles.arrangeActive : ''}>
                    <GripVertical size={17} aria-hidden="true" />
                    <span>
                      <strong>{name}</strong>
                      <small>{detail}</small>
                    </span>
                    <span className={styles.arrangePosition}>0{index + 1}</span>
                  </div>
                ))}
              </div>
              <small>Drag a section. Your preview updates instantly.</small>
            </div>
          )}
          {step === 2 && (
            <div className={styles.customizeEditor}>
              <span>Choose a palette that feels like you</span>
              <div className={styles.swatches}>
                {studioPalettes.map((palette, index) => (
                  <button
                    key={palette.name}
                    type="button"
                    aria-label={`Preview ${palette.name} colors`}
                    aria-pressed={paletteIndex === index}
                    onClick={() => setPaletteIndex(index)}
                    style={{ background: palette.hero }}
                  />
                ))}
              </div>
              <span>Your page, your visual language</span>
              <div className={styles.reorderRows}>
                <div>
                  <span className={styles.styleDetailIcon}>Aa</span>
                  Editorial type
                </div>
                <div>
                  <span className={styles.styleDetailIcon}>▢</span>
                  Rounded cards
                </div>
                <div>
                  <span className={styles.styleDetailIcon}>◉</span>
                  Your colors, throughout
                </div>
              </div>
              <small>Watch the same page change with every color.</small>
            </div>
          )}
          {step === 3 && (
            <div className={styles.ready}>
              <Check size={26} />
              <h4>Your page is ready.</h4>
              <p>One link for your ideas, favorites, and everything in between.</p>
              <Link className={styles.button} href="/auth?mode=signup">
                Create your page
              </Link>
            </div>
          )}
        </div>
        <div className={styles.studioPreview}>
          <p className={styles.previewCaption}>
            {step === 2
              ? 'See your palette come to life'
              : step === 3
                ? 'Your page. Ready to share.'
                : 'Live preview'}
          </p>
          <div className={styles.previewWithArrows}>
            <button
              type="button"
              onClick={() => choose(step - 1)}
              aria-label="Previous walkthrough step"
            >
              <ArrowLeft size={17} />
            </button>
            <StudioMiniPreview step={step} paletteIndex={paletteIndex} />
            <button
              type="button"
              onClick={() => choose(step + 1)}
              aria-label="Next walkthrough step"
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.stepNavigation}>
        <div>
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-current={step === index ? 'step' : undefined}
              onClick={() => choose(index)}
            >
              <span className={styles.stepTrack}>
                {step === index && (
                  <i
                    key={`${step}-${cycle}-${running}`}
                    className={running ? styles.progress : ''}
                  />
                )}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

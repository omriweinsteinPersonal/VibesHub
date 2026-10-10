'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Grid2X2,
  GripVertical,
  Link as LinkIcon,
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
};
type Product = { name: string; image: string };
const danielProducts: Product[] = [
  { name: 'Compact camera', image: assets.camera },
  { name: 'Table lamp', image: assets.lamp },
  { name: 'Lounge chair', image: assets.chair },
  { name: 'Ceramic mug', image: assets.mug },
];
const fashionProducts: Product[] = [
  { name: 'Everyday shoulder bag', image: assets.bag },
  { name: 'Everyday sneakers', image: assets.shoes },
];
const kitchenProducts: Product[] = [
  { name: 'Ceramic bowl', image: assets.bowl },
  { name: 'Pour over set', image: assets.pour },
];
const creators = [
  {
    name: 'Daniel Parks',
    handle: 'danielparks',
    details: 'Photo · Home · Everyday life',
    image: '/images/home/daniel.jpg',
    theme: 'daniel',
    products: danielProducts,
  },
  {
    name: 'Maren Louise',
    handle: 'marenlouise',
    details: 'Style · Wardrobe · Travel',
    image: '/images/home/maren-v2.jpg',
    theme: 'maren',
    products: fashionProducts,
  },
  {
    name: 'Miya',
    handle: 'chefmiya',
    details: 'Food · Home · Simple living',
    image: '/images/home/miya.jpg',
    theme: 'miya',
    products: kitchenProducts,
  },
] as const;

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

function CollectionTile({ kitchen = false }: { kitchen?: boolean }) {
  return (
    <div className={styles.collectionTile}>
      <div className={styles.collectionPhoto}>
        <Image
          src={kitchen ? assets.kitchenCollection : assets.fashionCollection}
          alt={kitchen ? 'Coffee and tableware' : 'Curated everyday wardrobe'}
          fill
          sizes="320px"
        />
      </div>
      <div>
        <strong>{kitchen ? 'Sunday table' : 'The Everyday Edit'}</strong>
        <ChevronRight size={15} aria-hidden="true" />
      </div>
      <small>Collection · {kitchen ? '5' : '8'} picks</small>
    </div>
  );
}

function CreatorCard({
  index,
  demo = false,
  collectionFirst = false,
}: {
  index: number;
  demo?: boolean;
  collectionFirst?: boolean;
}) {
  const creator = creators[index] ?? creators[0];
  return (
    <article
      className={`${styles.creatorCard} ${styles[creator.theme]} ${demo ? styles.demoCard : ''}`}
      aria-label={`${creator.name}, example creator page`}
    >
      <div className={styles.phoneStatus} aria-hidden="true">
        <span>9:41</span>
        <span>●●● ▰</span>
      </div>
      <div className={styles.identity}>
        <Image
          className={styles.avatar}
          src={creator.image}
          alt={creator.name}
          width={58}
          height={58}
          priority={!demo && index === 0}
        />
        <div>
          <strong>{creator.name}</strong>
          <span>{creator.details}</span>
        </div>
      </div>
      <p className={styles.creatorBio}>
        {index === 0
          ? 'Places, objects and everything in between.'
          : index === 1
            ? 'A little bold. Always personal.'
            : 'Good food, good company, a softer way to live.'}
      </p>
      <div className={styles.socialIcons} aria-label="Social platforms preview">
        <Image src="/connectors/instagram.svg" alt="Instagram" width={15} height={15} />
        <Image src="/connectors/youtube.svg" alt="YouTube" width={16} height={16} />
        <LinkIcon size={15} aria-hidden="true" />
      </div>
      <div className={styles.cardTabs} aria-hidden="true">
        {(index === 0
          ? ['Links', 'Gallery', 'Video', 'Shop']
          : index === 1
            ? ['Links', 'Shop', 'Collections', 'Instagram']
            : ['Links', 'Recipes', 'Video', 'Instagram']
        ).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className={styles.cardFeed}>
        {(index === 1 || index === 2 || collectionFirst) && (
          <CollectionTile kitchen={index === 2} />
        )}
        <ProductGrid products={creator.products} />
      </div>
      <div className={styles.phoneHomeIndicator} aria-hidden="true" />
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

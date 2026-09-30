'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Check, Layers, Palette, Tags } from 'lucide-react';
import styles from './creator-studio-demo.module.css';

const categories = [
  {
    title: 'Curate collections',
    detail: 'Bring your favorite finds together.',
    icon: Layers,
  },
  {
    title: 'Customize your feed',
    detail: 'Your colors. Your atmosphere.',
    icon: Palette,
  },
  { title: 'Shape every label', detail: 'Organize picks your way.', icon: Tags },
];
const scenes = [
  { category: 0, title: 'Add a pick' },
  { category: 0, title: 'Build a collection' },
  { category: 0, title: 'See it in your store' },
  { category: 1, title: 'Customize your header' },
  { category: 1, title: 'Make your feed yours' },
  { category: 1, title: 'Move things around' },
  { category: 2, title: 'Shape every label' },
  { category: 2, title: 'A home for every interest' },
  { category: 2, title: 'More of what you love' },
] as const;
const labels = ['All', 'My closet', 'Random', 'Beauty', 'Home & living'];
const products = [
  { name: 'Everyday shoulder bag', image: '/images/creator-demo-shoulder-bag.png' },
  { name: 'My favorite sneakers', image: '/images/creator-demo-sneakers.png' },
  { name: 'Sculptural gold hoops', image: '/images/creator-demo-earrings.png' },
  { name: 'Morning coffee', image: '/images/creator-demo-coffee-cup.png' },
  { name: 'Daily glow', image: '/images/hero-editorial-skincare.png' },
  { name: 'My makeup essentials', image: '/images/hero-editorial-makeup.png' },
  { name: 'Slow Sundays', image: '/images/hero-editorial-reading.png' },
  { name: 'Market day finds', image: '/images/hero-editorial-market.png' },
] as const;

function subscribeToMotionPreference(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function CreatorStudioDemo() {
  const [frame, setFrame] = useState(0);
  const storeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const [toneOverride, setTone] = useState<number | null>(null);
  const [labelOverride, setLabel] = useState<string | null>(null);
  const scene = scenes[frame] ?? scenes[0];
  const category = scene.category;
  const step = frame;
  const tone = toneOverride ?? (frame >= 4 ? 2 : frame === 3 ? 1 : 0);
  const label =
    labelOverride ??
    (frame === 6 ? 'My closet' : frame === 7 ? 'Random' : frame === 8 ? 'Beauty' : 'All');
  const indices =
    label === 'My closet'
      ? [0, 1, 2, 7]
      : label === 'Random'
        ? [3, 2, 6, 7]
        : label === 'Beauty'
          ? [4, 5, 2, 3]
          : label === 'Home & living'
            ? [3, 6, 7, 4]
            : [0, 1, 2, 3, 4, 5];
  const visibleProducts = indices.flatMap((index) =>
    products[index] ? [products[index]] : [],
  );
  if (frame === 5) visibleProducts.reverse();
  const goTo = (next: number) => {
    setFrame(next);
    setTone(null);
    setLabel(null);
  };
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % scenes.length);
      setTone(null);
      setLabel(null);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    store.scrollTo({ top: 0, behavior: 'auto' });
    if (frame !== 2 || reducedMotion) return;

    const scrollTimer = window.setTimeout(() => {
      store.scrollTo({ top: store.scrollHeight, behavior: 'smooth' });
    }, 900);
    return () => window.clearTimeout(scrollTimer);
  }, [frame, reducedMotion]);
  const advance = () => goTo((frame + 1) % scenes.length);
  const retreat = () => goTo((frame - 1 + scenes.length) % scenes.length);
  return (
    <div className={styles.demo}>
      <div className={styles.categories} aria-label="Explore creator features">
        {categories.map(({ title, detail, icon: Icon }, index) => (
          <button
            type="button"
            key={title}
            aria-pressed={category === index}
            onClick={() => {
              goTo([0, 3, 6][index] ?? 0);
            }}
          >
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{detail}</span>
          </button>
        ))}
      </div>
      <div className={styles.stage}>
        <div className={styles.canvas}>
          <div className={styles.sceneCaption} key={`caption-${frame}`}>
            <span className={styles.eyebrow}>MAYA’S CREATOR STUDIO</span>
            <h3>{scene.title}</h3>
          </div>
          {category === 0 && step < 2 ? (
            <div className={styles.editor} key={`editor-${step}`}>
              <span className={styles.eyebrow}>CREATOR DASHBOARD</span>
              <h4>{step === 0 ? 'Add recommendation' : 'Create collection'}</h4>
              {step === 0 ? (
                <>
                  <div className={styles.field}>
                    <span>
                      Item link <small>Optional</small>
                    </span>
                    <div>Paste a link, or add your own details</div>
                  </div>
                  <div className={styles.pick}>
                    <Image
                      src={products[0].image}
                      alt={products[0].name}
                      width={110}
                      height={130}
                    />
                    <div>
                      <div className={styles.field}>
                        <span>Item name</span>
                        <div>{products[0].name}</div>
                      </div>
                      <div className={styles.field}>
                        <span>Brand</span>
                        <div>Maya’s favorites</div>
                      </div>
                    </div>
                  </div>
                  <button className={styles.primary} type="button" onClick={advance}>
                    Save recommendation <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.field}>
                    <span>Collection name</span>
                    <div>Everyday favorites</div>
                  </div>
                  <span className={styles.selectionLabel}>
                    Choose your recommendations
                  </span>
                  {products.slice(0, 3).map((product) => (
                    <div className={styles.selection} key={product.name}>
                      <Image src={product.image} alt="" width={44} height={48} />
                      <span>{product.name}</span>
                      <Check size={17} aria-label="Selected" />
                    </div>
                  ))}
                  <button className={styles.primary} type="button" onClick={advance}>
                    Create collection <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              ref={storeRef}
              className={styles.store}
              style={{ background: ['#f6efe3', '#e0e6d5', '#eedee1'][tone] }}
            >
              <header className={styles.profile}>
                <Image
                  src="/images/creator-maya-avatar.png"
                  alt="Maya Cohen"
                  width={56}
                  height={56}
                />
                <div>
                  <h4>Maya Cohen</h4>
                  <span>Lifestyle · @just_maya</span>
                </div>
              </header>
              <p className={styles.bio}>
                Good taste, daily aesthetics, and little things I love.
              </p>
              <div className={styles.socials}>
                {['instagram', 'tiktok', 'youtube'].map((name) => (
                  <Image
                    key={name}
                    src={`/connectors/${name}.svg`}
                    alt={name}
                    width={20}
                    height={20}
                  />
                ))}
              </div>
              <div
                className={styles.feed}
                style={{
                  background:
                    frame >= 4 ? ['#fffdf9', '#f1f3ea', '#f4e9df'][tone] : '#fffdf9',
                }}
              >
                <div className={styles.labels}>
                  {labels.map((name) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={label === name}
                      onClick={() => {
                        setLabel(name);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <span className={styles.eyebrow}>MAYA’S FAVORITES</span>
                <h4>
                  {label === 'Random' ? 'Little things I love' : 'Everyday favorites'}
                </h4>
                <p className={styles.caption}>
                  {category === 0
                    ? 'Your collection, ready to explore.'
                    : 'Picked and shared by Maya.'}
                </p>
                <div className={styles.products}>
                  {visibleProducts.map((product) => (
                    <article key={product.name}>
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={180}
                        height={210}
                      />
                      <span>{product.name}</span>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.transport}>
        <button type="button" onClick={retreat} aria-label="Previous scene">
          <ArrowLeft size={17} />
        </button>
        <div className={styles.progress}>
          {scenes.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={item.title}
              aria-current={frame === index ? 'step' : undefined}
              onClick={() => {
                goTo(index);
              }}
            />
          ))}
        </div>
        <button type="button" onClick={advance} aria-label="Next scene">
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

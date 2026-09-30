'use client';

import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import styles from './creator-landing-hero.module.css';

const examples = [
  {
    theme: 'red',
    name: 'Maya Cohen',
    handle: 'just_maya',
    category: 'THE FASHION EDIT',
    bio: 'A little bold. Always personal.',
    title: 'Currently obsessed.',
    avatar: 'creator-maya-avatar.png',
    tags: ['All picks', 'My closet', 'Finishing touches'],
    collection: 'The everyday edit',
    note: 'Good pieces. Endless possibilities.',
    products: [
      ['creator-demo-shoulder-bag.png', 'The take-everywhere bag'],
      ['creator-demo-earrings.png', 'A little golden hour'],
      ['hero-editorial-fashion.png', 'My off-duty uniform'],
      ['creator-demo-sneakers.png', 'On repeat'],
    ],
  },
  {
    theme: 'sand',
    name: 'Ella Rosen',
    handle: 'at_ellas_table',
    category: 'FOOD & SLOW MORNINGS',
    bio: 'Come hungry. Stay a little longer.',
    title: 'From my kitchen, with love.',
    avatar: 'hero-editorial-creator.png',
    tags: ['The table', 'Kitchen finds', 'Sunday rituals'],
    collection: 'A slow Sunday',
    note: 'Coffee, something sweet & nowhere to be.',
    products: [
      ['hero-editorial-food.png', 'For the Sunday table'],
      ['creator-demo-coffee-cup.png', 'My morning companion'],
      ['hero-editorial-market.png', 'Fresh from the market'],
      ['hero-editorial-coffee.png', 'The coffee corner'],
    ],
  },
  {
    theme: 'slate',
    name: 'Noah Levi',
    handle: 'noah.in.frames',
    category: 'PHOTOGRAPHY / HOME / LIFE',
    bio: 'Objects, spaces and the moments between.',
    title: 'Through my lens.',
    avatar: 'hero-editorial-man-reading.png',
    tags: ['Selected', 'At home', 'Out of office'],
    collection: 'The quiet corner',
    note: 'Small things that make a space yours.',
    products: [
      ['hero-editorial-reading.png', 'A slower point of view'],
      ['hero-editorial-man-coffee.png', 'Light, coffee, repeat'],
      ['hero-editorial-man-reading.png', 'Notes from the weekend'],
      ['hero-editorial-lifestyle.png', 'Everyday details'],
    ],
  },
  {
    theme: 'green',
    name: 'Adam Shalev',
    handle: 'adam.wears',
    category: 'EVERYDAY MENSWEAR',
    bio: 'Less overthinking. More good outfits.',
    title: 'Wear it your way.',
    avatar: 'hero-editorial-man-fashion.png',
    tags: ['The rotation', 'Easy layers', 'Weekend'],
    collection: 'Out of office',
    note: 'Your weekend uniform, sorted.',
    products: [
      ['hero-editorial-man-fashion.png', 'The relaxed fit'],
      ['creator-demo-sneakers.png', 'The everyday pair'],
      ['hero-editorial-man-lifestyle.png', 'Weekend layers'],
      ['hero-editorial-man-grooming.png', 'Finishing the routine'],
    ],
  },
] as const;

export function CreatorLandingHero() {
  const [active, setActive] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const example = examples[active]!;
  function move(direction: number) {
    setActive((current) => (current + direction + examples.length) % examples.length);
  }

  return (
    <section className={styles.hero} id="top">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>
          <Sparkles size={14} aria-hidden="true" /> YOUR TASTE. YOUR LITTLE WORLD.
        </p>
        <h1>
          Your world,
          <br />
          curated in one place.
        </h1>
        <p className={styles.lede}>
          The things you love. The style that’s yours.
          <br />
          One beautiful page to share it all.
        </p>
        <form action="/auth" method="get" className={styles.claim}>
          <input type="hidden" name="mode" value="login" />
          <label htmlFor="creator-page-name">Make a little space for yourself</label>
          <div className={styles.claimRow}>
            <div className={styles.nameField}>
              <input
                id="creator-page-name"
                name="name"
                placeholder="yourname"
                aria-label="Your name (optional)"
                autoComplete="nickname"
                maxLength={100}
              />
              <span aria-hidden="true">.swavii</span>
            </div>
            <button type="submit">
              Let’s swavii <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p>
            <Check size={13} aria-hidden="true" /> First month free{' '}
            <span>Then $12 / month</span>
          </p>
        </form>
      </div>

      <div
        className={styles.showcase}
        role="region"
        aria-roledescription="carousel"
        aria-label="Explore example creator pages"
      >
        <div className={styles.galleryHeading}>
          <span>FOUR WORLDS. ENDLESS POSSIBILITIES.</span>
          <span>0{active + 1} / 04</span>
        </div>
        <div
          className={styles.stage}
          data-theme={example.theme}
          onTouchStart={(event) => {
            const point = event.touches[0];
            if (point) swipe.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchEnd={(event) => {
            const point = event.changedTouches[0];
            const start = swipe.current;
            swipe.current = null;
            if (!point || !start) return;
            const dx = point.clientX - start.x;
            if (
              Math.abs(dx) > 45 &&
              Math.abs(dx) > Math.abs(point.clientY - start.y) * 1.5
            )
              move(dx < 0 ? 1 : -1);
          }}
        >
          <article
            className={styles.page}
            data-theme={example.theme}
            key={example.handle}
            aria-label={`${example.name}: ${example.category}`}
          >
            <div className={styles.pageAddress}>
              <span>swavii / {example.handle}</span>
              <span aria-hidden="true">↗</span>
            </div>
            <header className={styles.profile}>
              <Image
                className={styles.avatar}
                src={`/images/${example.avatar}`}
                alt=""
                width={64}
                height={64}
                sizes="64px"
              />
              <p className={styles.category}>{example.category}</p>
              <h2>{example.name}</h2>
              <p className={styles.bio}>{example.bio}</p>
              <div className={styles.social}>
                <Image
                  src="/connectors/instagram.svg"
                  alt="Instagram"
                  width={15}
                  height={15}
                />
                <span>@{example.handle}</span>
                <span className={styles.follow}>Follow along ↗</span>
              </div>
            </header>
            <div className={styles.content}>
              <div className={styles.tags}>
                {example.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                <Search size={13} aria-hidden="true" />
              </div>
              <div className={styles.collection}>
                <span>THE COLLECTION</span>
                <h3>{example.collection}</h3>
                <p>{example.note}</p>
                <ArrowRight size={19} aria-hidden="true" />
              </div>
              <div className={styles.editHeading}>
                <h3>{example.title}</h3>
                <span>MY PICKS</span>
              </div>
              <div className={styles.grid}>
                {example.products.map(([image, name], index) => (
                  <div className={styles.product} key={name}>
                    <div className={styles.productImage}>
                      <Image
                        src={`/images/${image}`}
                        alt={name}
                        fill
                        sizes="(max-width: 600px) 135px, 170px"
                        priority={active === 0 && index < 2}
                      />
                    </div>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.continued} aria-hidden="true">
              More to discover ↓
            </div>
          </article>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous creator page"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.dots}>
            {examples.map((item, index) => (
              <button
                type="button"
                key={item.handle}
                data-theme={item.theme}
                aria-label={`View ${item.name}'s ${item.category.toLowerCase()} page`}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next creator page">
            <ArrowRight size={18} />
          </button>
        </div>
        <p className={styles.exampleNote} aria-live="polite">
          {example.name} · {example.category.toLowerCase()}
          <span>Example page · Make yours your own</span>
        </p>
      </div>
    </section>
  );
}

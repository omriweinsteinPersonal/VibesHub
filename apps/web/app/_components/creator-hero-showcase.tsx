'use client';

import Image from 'next/image';
import { BarChart3, Palette, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CreatorConnectorIcon } from './creator-connector-icon';

const showcaseGroups = [
  {
    label: 'Latest',
    note: {
      detail: 'Every color, every detail',
      title: 'Your style',
      type: 'style',
    },
    products: [
      {
        image: '/images/hero-editorial-lifestyle.png',
        name: 'Everyday shoulder bag',
        price: '$189',
      },
      {
        image: '/images/hero-editorial-fashion.png',
        name: 'My favorite sneakers',
        price: '$329',
      },
      {
        image: '/images/hero-editorial-jewelry.png',
        name: 'Sculptural gold hoops',
        price: '$149',
      },
      {
        image: '/images/hero-editorial-coffee.png',
        name: 'Handmade coffee cup',
        price: '$89',
      },
      {
        image: '/images/hero-editorial-reading.png',
        name: 'A quiet Sunday read',
        price: '$74',
      },
      {
        image: '/images/hero-editorial-market.png',
        name: 'Market day essentials',
        price: '$119',
      },
      {
        image: '/images/hero-editorial-man-coffee.png',
        name: 'Morning coffee ritual',
        price: '$68',
      },
      {
        image: '/images/hero-editorial-man-reading.png',
        name: 'Carry-on journal',
        price: '$94',
      },
      {
        image: '/images/hero-editorial-food.png',
        name: 'Dinner plans',
        price: '$156',
      },
      {
        image: '/images/hero-editorial-man-lifestyle.png',
        name: 'Weekend uniform',
        price: '$219',
      },
    ],
  },
  {
    label: 'Beauty',
    note: {
      detail: 'Discover your most-loved glow',
      title: 'Beauty insights',
      type: 'insights',
    },
    products: [
      {
        image: '/images/hero-editorial-skincare.png',
        name: 'Daily skin ritual',
        price: '$124',
      },
      {
        image: '/images/hero-editorial-makeup.png',
        name: 'Soft glow essentials',
        price: '$169',
      },
      {
        image: '/images/hero-editorial-man-grooming.png',
        name: 'Clean grooming kit',
        price: '$98',
      },
      {
        image: '/images/hero-editorial-jewelry.png',
        name: 'Golden finishing touch',
        price: '$149',
      },
      {
        image: '/images/hero-editorial-lifestyle.png',
        name: 'Body care favourites',
        price: '$112',
      },
      {
        image: '/images/hero-editorial-reading.png',
        name: 'Nighttime wind down',
        price: '$86',
      },
      {
        image: '/images/hero-editorial-skincare.png',
        name: 'Vitamin C serum',
        price: '$132',
      },
      {
        image: '/images/hero-editorial-makeup.png',
        name: 'Tinted balm',
        price: '$78',
      },
      {
        image: '/images/hero-editorial-lifestyle.png',
        name: 'Everyday body oil',
        price: '$104',
      },
      {
        image: '/images/hero-editorial-creator.png',
        name: 'Signature scent',
        price: '$189',
      },
    ],
  },
  {
    label: 'Fashion',
    note: {
      detail: 'New looks, always in motion',
      title: 'Fresh picks',
      type: 'fresh',
    },
    products: [
      {
        image: '/images/hero-editorial-fashion.png',
        name: 'The everyday edit',
        price: '$249',
      },
      {
        image: '/images/hero-editorial-man-fashion.png',
        name: 'Weekend layers',
        price: '$319',
      },
      {
        image: '/images/hero-editorial-man-lifestyle.png',
        name: 'Classic white sneakers',
        price: '$329',
      },
      {
        image: '/images/hero-editorial-market.png',
        name: 'Soft leather shoulder bag',
        price: '$189',
      },
      {
        image: '/images/hero-editorial-jewelry.png',
        name: 'Sculptural gold hoops',
        price: '$149',
      },
      {
        image: '/images/hero-editorial-creator.png',
        name: 'Off-duty uniform',
        price: '$279',
      },
      {
        image: '/images/hero-editorial-fashion.png',
        name: 'Soft tailored set',
        price: '$286',
      },
      {
        image: '/images/hero-editorial-man-fashion.png',
        name: 'City trench',
        price: '$394',
      },
      {
        image: '/images/hero-editorial-jewelry.png',
        name: 'Fine gold stack',
        price: '$178',
      },
      {
        image: '/images/hero-editorial-man-lifestyle.png',
        name: 'Relaxed denim',
        price: '$238',
      },
    ],
  },
] as const;

function ShowcaseNoteIcon({
  type,
}: {
  type: (typeof showcaseGroups)[number]['note']['type'];
}) {
  if (type === 'insights') return <BarChart3 aria-hidden="true" size={18} />;
  if (type === 'fresh') return <Sparkles aria-hidden="true" size={18} />;

  return <Palette aria-hidden="true" size={18} />;
}

export function CreatorHeroShowcase() {
  const [activeGroup, setActiveGroup] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const interval = window.setInterval(() => {
      setActiveGroup((current) => (current + 1) % showcaseGroups.length);
    }, 10_400);

    return () => window.clearInterval(interval);
  }, []);

  const active = showcaseGroups[activeGroup]!;
  const tabOrder = [0, 2, 1] as const;

  return (
    <div className="creatorHeroVisual" aria-label="Example creator recommendation page">
      <div className={`creatorHeroGlow creatorHeroGlow${activeGroup + 1}`} />
      <div className="creatorPhone">
        <div className="creatorPhoneTop">
          <span />
        </div>
        <div className="creatorPhoneProfile">
          <div className="creatorDemoAvatar">
            <Image
              alt="Maya Cohen"
              fill
              sizes="45px"
              src="/images/hero-editorial-creator.png"
            />
          </div>
          <div>
            <strong>Maya Cohen</strong>
            <span>Style, travel &amp; everyday finds</span>
          </div>
        </div>
        <div className="creatorDemoSocials">
          <span aria-label="Instagram">
            <CreatorConnectorIcon platform="instagram" />
          </span>
          <span aria-label="TikTok">
            <CreatorConnectorIcon platform="tiktok" />
          </span>
          <span aria-label="YouTube">
            <CreatorConnectorIcon platform="youtube" />
          </span>
        </div>
        <div className="creatorDemoSearch">Search my recommendations...</div>
        <div
          className="creatorDemoTabs"
          role="tablist"
          aria-label="Recommendation groups"
        >
          {tabOrder.map((index) => {
            const group = showcaseGroups[index]!;

            return (
              <button
                aria-selected={index === activeGroup}
                className={index === activeGroup ? 'active' : undefined}
                key={group.label}
                onClick={() => setActiveGroup(index)}
                role="tab"
                type="button"
              >
                {group.label}
              </button>
            );
          })}
        </div>
        <div className="creatorDemoShowcaseViewport" aria-live="polite">
          <div className="creatorDemoShowcaseGrid" key={active.label}>
            {active.products.map((product) => (
              <article
                className="creatorDemoShowcaseCard"
                key={`${active.label}-${product.name}`}
              >
                <div className="creatorDemoShowcaseImage">
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 620px) 108px, 124px"
                    src={product.image}
                  />
                </div>
                <p>{product.name}</p>
                <strong>{product.price}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`creatorFloatingCard creatorShowcaseNote creatorShowcaseNote${activeGroup + 1}`}
      >
        <ShowcaseNoteIcon type={active.note.type} />
        <span>
          <strong>{active.note.title}</strong>
          {active.note.detail}
        </span>
      </div>
    </div>
  );
}

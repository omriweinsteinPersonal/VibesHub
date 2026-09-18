'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const tileImages = [
  [
    '/images/hero-editorial-creator.png',
    '/images/hero-editorial-man-fashion.png',
    '/images/hero-editorial-market.png',
  ],
  [
    '/images/hero-editorial-skincare.png',
    '/images/hero-editorial-man-grooming.png',
    '/images/hero-editorial-makeup.png',
  ],
  [
    '/images/hero-editorial-fashion.png',
    '/images/hero-editorial-man-lifestyle.png',
    '/images/hero-editorial-jewelry.png',
  ],
  [
    '/images/hero-editorial-coffee.png',
    '/images/hero-editorial-man-coffee.png',
    '/images/hero-editorial-food.png',
  ],
  [
    '/images/hero-editorial-lifestyle.png',
    '/images/hero-editorial-man-reading.png',
    '/images/hero-editorial-reading.png',
  ],
] as const;

export function RotatingHeroCollage() {
  const [activeMoment, setActiveMoment] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rotation = window.setInterval(() => {
      setActiveMoment((current) => (current + 1) % 3);
    }, 6_500);

    return () => window.clearInterval(rotation);
  }, []);

  return (
    <div
      className="editorialCollage rotatingHeroCollage"
      aria-label="Fashion, beauty, coffee and creator editorial gallery"
    >
      {tileImages.map((images, tile) => (
        <div className={`rotatingHeroTile tile${tile + 1}`} key={images[0]}>
          {images.map((url, imageIndex) => (
            <Image
              alt=""
              aria-hidden="true"
              className={activeMoment === imageIndex ? 'active' : undefined}
              fill
              key={url}
              priority={imageIndex === 0}
              sizes={
                tile === 0
                  ? '(max-width: 900px) 38vw, 22vw'
                  : '(max-width: 900px) 30vw, 15vw'
              }
              src={url}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

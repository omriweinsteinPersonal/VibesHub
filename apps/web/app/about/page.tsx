import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const metadata: Metadata = {
  description:
    'Learn why Swave puts trusted Israeli creators at the center of product discovery.',
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="editorialPage">
      <SiteHeader />
      <main className="aboutMain">
        <p className="eyebrow">ABOUT</p>
        <h1>A marketplace built around the people you already trust</h1>

        <div className="aboutGrid">
          <div className="aboutImage">
            <Image
              alt="Israeli creator surrounded by fashion, beauty and food recommendations"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              src="/images/hero-collage.jpg"
            />
          </div>
          <div className="aboutCopy">
            <p>
              Israeli shoppers discover products in DMs, story replies and screenshots. We
              gave that conversation a home.
            </p>
            <p>
              Creators open a storefront in minutes, add the products they actually use,
              write the review in their own words and attach the codes their audience asks
              for. Shoppers get one place to find it all — searchable, saveable and
              honest.
            </p>
            <p>
              We take a flat marketplace fee and never sell placement. If a product sits
              at the top of a feed, it is because creators put it there.
            </p>

            <div className="aboutActions">
              <Link className="button primary" href="/creators">
                Explore Creators
              </Link>
              <Link className="button secondary" href="/shoppers">
                For shoppers
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

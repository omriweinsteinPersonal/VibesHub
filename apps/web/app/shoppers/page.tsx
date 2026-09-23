import type { DiscoveryRecommendationCard } from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bookmark, Search, Tag, type LucideIcon } from 'lucide-react';

import { publicApiCollectionRequest } from '../../lib/api';
import { EngagementProvider } from '../_components/engagement';
import { RecommendationCardView } from '../_components/recommendation-card';
import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description:
    'Find, save and shop products recommended by the Israeli creators you trust.',
  title: 'For shoppers',
};

const steps = [
  {
    description:
      'Browse by category or search a creator you already follow on Instagram or TikTok.',
    icon: Search,
    number: '01',
    title: 'Find your taste',
  },
  {
    description:
      'Build a wishlist across creators and get notified when a product drops in price.',
    icon: Bookmark,
    number: '02',
    title: 'Save what you love',
  },
  {
    description:
      "Every storefront carries the creator's own codes, checked weekly by our team.",
    icon: Tag,
    number: '03',
    title: 'Shop with a code',
  },
];

export default async function ShoppersPage() {
  let recommendations: DiscoveryRecommendationCard[] = [];
  let unavailable = false;

  try {
    const page = await publicApiCollectionRequest<DiscoveryRecommendationCard>(
      '/discover/recommendations?sort=most-saved&limit=4',
    );
    recommendations = page.data.slice(0, 4);
  } catch {
    unavailable = true;
  }

  return (
    <div className="editorialPage">
      <SiteHeader />
      <main>
        <section className="shoppersHero">
          <p className="eyebrow">FOR SHOPPERS</p>
          <h1>Buy from people, not from banners</h1>
          <p className="lede">
            swavii turns the recommendations you already screenshot into a place you can
            actually shop from.
          </p>
          <div className="heroButtons">
            <Link className="button primary" href="/creators">
              Explore Creators
            </Link>
            <Link className="button secondary" href="/discover">
              Discover Products
            </Link>
          </div>

          <div className="shopperSteps">
            {steps.map((step) => {
              const Icon = step.icon as LucideIcon;
              return (
                <article className="shopperStep" key={step.number}>
                  <span className="shopperStepNumber">{step.number}</span>
                  <span className="shopperStepIcon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="shopperFavorites" aria-labelledby="shopper-favorites-title">
          <div className="shopperFavoritesHeading">
            <div>
              <p className="eyebrow">SHOPPER FAVORITES</p>
              <h2 id="shopper-favorites-title">Most saved this month</h2>
            </div>
            <Link href="/discover?sort=most-saved">
              See everything <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>

          {unavailable ? (
            <div className="directoryState" role="status">
              <h3>Shopper favorites are temporarily unavailable</h3>
              <p>Please try again in a moment.</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="directoryState">
              <h3>Favorites will appear here soon</h3>
              <p>Save products in Discover to help shape this collection.</p>
            </div>
          ) : (
            <EngagementProvider
              productIds={recommendations.map((item) => item.productId)}
            >
              <div className="storeProductGrid">
                {recommendations.map((recommendation) => (
                  <RecommendationCardView
                    creator={recommendation.creator}
                    key={recommendation.id}
                    recommendation={recommendation}
                    showSave
                  />
                ))}
              </div>
            </EngagementProvider>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

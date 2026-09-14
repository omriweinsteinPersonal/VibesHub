import type { CategoryCard, DiscoveryRecommendationCard } from '@vibeshub/contracts';
import Link from 'next/link';
import { ArrowRight, Heart, ShieldCheck, Sparkles, Tag } from 'lucide-react';

import { publicApiCollectionRequest } from '../lib/api';
import { EngagementProvider } from './_components/engagement';
import { RecommendationCardView } from './_components/recommendation-card';
import { RotatingHeroCollage } from './_components/rotating-hero-collage';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let categories: CategoryCard[] = [];
  let recommendations: DiscoveryRecommendationCard[] = [];
  try {
    const [categoryPage, recommendationPage] = await Promise.all([
      publicApiCollectionRequest<CategoryCard>('/categories'),
      publicApiCollectionRequest<DiscoveryRecommendationCard>(
        '/discover/recommendations?sort=most-saved',
      ),
    ]);
    categories = categoryPage.data;
    recommendations = recommendationPage.data.slice(0, 6);
  } catch {
    // The homepage remains useful while local services are starting.
  }

  return (
    <div className="editorialPage">
      <SiteHeader />
      <main>
        <section className="hero" id="top">
          <div className="heroCopy">
            <p className="eyebrow heroCreatorCount">
              <Sparkles aria-hidden="true" size={14} />
              ISRAELI CREATORS
            </p>
            <h1>
              Discover what your favorite creators <em>recommend</em>
            </h1>
            <p className="lede">
              Shop authentic recommendations, exclusive discounts and products loved by
              Israeli creators.
            </p>
            <div className="heroButtons">
              <Link className="button primary" href="/creators">
                Explore Creators
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link className="button secondary" href="/discover">
                Discover Products
              </Link>
            </div>
          </div>
          <RotatingHeroCollage />
        </section>

        {categories.length ? (
          <section className="categoryBand" id="categories" aria-label="Categories">
            {categories.map((category) => (
              <Link href={`/discover?category=${category.slug}`} key={category.id}>
                {category.name}
                <Sparkles aria-hidden="true" size={12} />
              </Link>
            ))}
          </section>
        ) : null}

        <section className="section" id="products">
          <p className="eyebrow">SELECTED PRODUCTS</p>
          <h2>Latest creator recommendations</h2>
          <p className="sectionIntro">Products published by creators on VibesHub.</p>
          {recommendations.length ? (
            <EngagementProvider
              productIds={recommendations.map((item) => item.productId)}
            >
              <div className="productGrid storeProductGrid">
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
          ) : (
            <div className="directoryState">
              <h3>No recommendations yet</h3>
              <p>Creator recommendations will appear here after they are published.</p>
            </div>
          )}
        </section>

        <section className="trust" id="about">
          <p className="eyebrow">WHY VIBESHUB</p>
          <h2>Built on trust, not on ad budgets</h2>
          <div className="trustGrid">
            <article>
              <span aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <h3>Creator-owned storefronts</h3>
              <p>Each storefront brings a creator&apos;s recommendations together.</p>
            </article>
            <article>
              <span aria-hidden="true">
                <Heart size={18} />
              </span>
              <h3>Personal recommendations</h3>
              <p>Creators can explain why they recommend every product.</p>
            </article>
            <article>
              <span aria-hidden="true">
                <Tag size={18} />
              </span>
              <h3>Useful offers</h3>
              <p>Product links and available discount codes stay in one place.</p>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

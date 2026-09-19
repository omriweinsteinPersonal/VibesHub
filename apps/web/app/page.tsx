import type { CategoryCard, DiscoveryRecommendationCard } from '@vibeshub/contracts';
import Link from 'next/link';
import { ArrowRight, Heart, ShieldCheck, Sparkles, Tag } from 'lucide-react';

import { publicApiCollectionRequest } from '../lib/api';
import { EngagementProvider } from './_components/engagement';
import { InstagramIcon } from './_components/instagram-icon';
import { RecommendationCardView } from './_components/recommendation-card';
import { RotatingHeroCollage } from './_components/rotating-hero-collage';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

export const dynamic = 'force-dynamic';

const swaveInstagramUrl = process.env.NEXT_PUBLIC_SWAVE_INSTAGRAM_URL;

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
          <h2>Latest creator recommendations</h2>
          <p className="sectionIntro">Products published by creators on Swave.</p>
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
          <p className="eyebrow">WHY SWAVE</p>
          <h2>Built on trust, not on ad budgets</h2>
          <div className="trustGrid" dir="rtl" lang="he">
            <article>
              <span aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <h3>חנויות אישיות של יוצרים</h3>
              <p>כל חנות מרוכזת במקום אחד</p>
            </article>
            <article>
              <span aria-hidden="true">
                <Heart size={18} />
              </span>
              <h3>המלצות אישיות</h3>
              <p>יוצרים מסבירים למה הם ממליצים על כל מוצר</p>
            </article>
            <article>
              <span aria-hidden="true">
                <Tag size={18} />
              </span>
              <h3>הטבות בלעדיות</h3>
              <p>גישה להנחות והטבות מיוחדות לקהילה</p>
            </article>
          </div>
        </section>

        <section className="homeInstagram" aria-labelledby="home-instagram-title">
          <div className="homeInstagramCopy">
            <p className="eyebrow">ON INSTAGRAM</p>
            <h2 id="home-instagram-title">Find us on Instagram</h2>
            <p>Meet the people, products, and stories shaping Swave.</p>
          </div>
          {swaveInstagramUrl ? (
            <a
              className="button homeInstagramLink"
              href={swaveInstagramUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <InstagramIcon aria-hidden="true" size={16} />
              Follow Swave
              <ArrowRight aria-hidden="true" size={14} />
            </a>
          ) : (
            <button className="button homeInstagramLink" disabled type="button">
              <InstagramIcon aria-hidden="true" size={16} />
              Instagram soon
            </button>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

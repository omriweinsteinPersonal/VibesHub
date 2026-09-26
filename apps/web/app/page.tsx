import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ExternalLink,
  Palette,
  Plus,
  Share2,
  Sparkles,
} from 'lucide-react';

import { SiteFooter } from './_components/site-footer';
import { CreatorHeroShowcase } from './_components/creator-hero-showcase';
import { SiteHeader } from './_components/site-header';

const signupHref = '/auth?mode=signup';

export default function HomePage() {
  return (
    <div className="creatorLandingPage">
      <SiteHeader />
      <main>
        <section className="creatorHero" id="top">
          <div className="creatorHeroCopy">
            <p className="creatorLandingEyebrow">
              <Sparkles aria-hidden="true" size={14} /> Your recommendations, your space
            </p>
            <h1>Your world, curated in one place.</h1>
            <p className="creatorHeroLede">
              Share your lifestyle, curate your picks in a designed showcase made for your
              world.
            </p>
            <div className="creatorHeroActions">
              <Link className="button primary creatorPrimaryCta" href={signupHref}>
                Create your page <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a className="button secondary" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="creatorHeroNote">
              <span>
                <Check aria-hidden="true" size={14} /> No code required
              </span>
              <span>
                <Check aria-hidden="true" size={14} /> Open to every creator
              </span>
            </div>
          </div>

          <CreatorHeroShowcase />
        </section>

        <section className="creatorValueStrip" aria-label="Platform highlights">
          <span>One link for everything</span>
          <i />
          <span>Made for creators</span>
          <i />
          <span>Designed by you</span>
          <i />
          <span>Easy to update</span>
        </section>

        <section className="creatorLandingSection creatorSteps" id="how-it-works">
          <div className="creatorSectionHeading">
            <p className="creatorLandingEyebrow">HOW IT WORKS</p>
            <h2>Design your digital world in minutes.</h2>
            <p>
              Stop wasting time managing scattered links. swavii lets you curate your
              world, design your layout, and share everything in one amazing place.
            </p>
          </div>
          <div className="creatorStepGrid">
            <article>
              <span>01</span>
              <Plus aria-hidden="true" />
              <h3>Add what you love</h3>
              <p>
                Collect your favorite products, brands, and lifestyle picks in one simple
                dashboard.
              </p>
            </article>
            <article>
              <span>02</span>
              <Palette aria-hidden="true" />
              <h3>Make it yours</h3>
              <p>
                Customize colors, sections, and layout to match your personal brand and
                aesthetic.
              </p>
            </article>
            <article>
              <span>03</span>
              <Share2 aria-hidden="true" />
              <h3>Share one link</h3>
              <p>Place your showcase link in any social bio.</p>
            </article>
          </div>
        </section>

        <section className="creatorLandingSection creatorAudience" id="features">
          <div className="creatorAudienceIntro">
            <p className="creatorLandingEyebrow">AUDIENCE ANALYTICS</p>
            <h2>Know your audience. Keep them engaged.</h2>
            <p>
              Follow every click, learn what is converting and see where your audience is
              coming from, all in one clear view.
            </p>
            <Link className="creatorTextLink" href={signupHref}>
              Explore your analytics <ArrowRight size={15} />
            </Link>
          </div>
          <div
            className="creatorAnalyticsPreview"
            aria-label="Example creator analytics dashboard"
          >
            <header>
              <div>
                <span>ANALYTICS</span>
                <strong>Your audience at a glance</strong>
              </div>
              <span className="creatorAnalyticsRange">Last 30 days</span>
            </header>
            <div className="creatorAnalyticsMetrics">
              <article>
                <span>Audience</span>
                <strong>12.8K</strong>
                <small>↑ 18.4%</small>
              </article>
              <article>
                <span>Product clicks</span>
                <strong>4,286</strong>
                <small>↑ 24.1%</small>
              </article>
              <article>
                <span>Engagement</span>
                <strong>8.6%</strong>
                <small>↑ 2.3%</small>
              </article>
              <article>
                <span>Average order</span>
                <strong>$214</strong>
                <small>↑ 12.8%</small>
              </article>
            </div>
            <div className="creatorAnalyticsDashboard">
              <section className="creatorAnalyticsChart">
                <div className="creatorAnalyticsPanelHeading">
                  <div>
                    <span>PRODUCT CLICKS</span>
                    <strong>What is gaining attention</strong>
                  </div>
                  <BarChart3 aria-hidden="true" size={16} />
                </div>
                <div className="creatorAnalyticsBars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="creatorAnalyticsAxis">
                  <span>01 Jun</span>
                  <span>30 Jun</span>
                </div>
              </section>
              <section className="creatorTopProducts">
                <div className="creatorAnalyticsPanelHeading">
                  <div>
                    <span>TOP PRODUCTS</span>
                    <strong>Most clicked</strong>
                  </div>
                </div>
                <ol>
                  <li>
                    <span>Soft leather shoulder bag</span>
                    <strong>1,284</strong>
                  </li>
                  <li>
                    <span>Daily skin ritual</span>
                    <strong>968</strong>
                  </li>
                  <li>
                    <span>Weekend layers</span>
                    <strong>742</strong>
                  </li>
                </ol>
              </section>
              <section className="creatorAudienceCountries">
                <div className="creatorAnalyticsPanelHeading">
                  <div>
                    <span>AUDIENCE BY COUNTRY</span>
                    <strong>Where they are</strong>
                  </div>
                </div>
                <div>
                  <span>
                    🇮🇱 Israel <strong>42%</strong>
                  </span>
                  <span>
                    🇺🇸 United States <strong>24%</strong>
                  </span>
                  <span>
                    🇬🇧 United Kingdom <strong>13%</strong>
                  </span>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="creatorLandingSection creatorPricing" id="pricing">
          <div className="creatorSectionHeading">
            <p className="creatorLandingEyebrow">PRICING</p>
            <h2>Start building your space.</h2>
            <p>
              Pricing plans are coming soon. Join now to help shape swavii for creators.
            </p>
          </div>
          <div className="creatorPricingCard">
            <div>
              <p>EARLY ACCESS</p>
              <h3>Build your creator page</h3>
              <span>Everything you need to start sharing your recommendations.</span>
            </div>
            <ul>
              <li>
                <Check size={15} /> A public link-in-bio page
              </li>
              <li>
                <Check size={15} /> Products, collections and brands
              </li>
              <li>
                <Check size={15} /> Custom colors and layout
              </li>
              <li>
                <Check size={15} /> Performance analytics
              </li>
            </ul>
            <Link className="button primary" href={signupHref}>
              Join early access <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="creatorFinalCta">
          <p className="creatorLandingEyebrow">YOUR PAGE, YOUR WAY</p>
          <h2>Give every recommendation a place to live.</h2>
          <p>Create one beautiful page, then share it everywhere.</p>
          <Link className="button creatorLightCta" href={signupHref}>
            Create your page <ArrowRight size={17} />
          </Link>
        </section>

        <section className="creatorInstagram" aria-labelledby="instagram-heading">
          <div>
            <p className="creatorLandingEyebrow">FIND US ON INSTAGRAM</p>
            <h2 id="instagram-heading">Follow along with swavii.</h2>
            <p>Creator inspiration, curated worlds and what we are building next.</p>
          </div>
          <a
            className="creatorInstagramLink"
            href="https://www.instagram.com/swavii_?stkn=MXN1Z2E3Z2IzcDU2dw%3D%3D&utm_source=qr"
            target="_blank"
            rel="noreferrer"
          >
            <Camera size={20} /> @swavii_
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

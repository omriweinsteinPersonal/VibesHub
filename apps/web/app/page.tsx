import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  ExternalLink,
  Heart,
  LayoutGrid,
  Palette,
  Plus,
  Share2,
  Sparkles,
} from 'lucide-react';

import { SiteFooter } from './_components/site-footer';
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
            <h1>
              The only place your audience finds <em>everything</em> about you.
            </h1>
            <p className="creatorHeroLede">
              Build a beautiful recommendation page for every product, brand and
              collection you love. Share one link and make it entirely yours.
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

          <div
            className="creatorHeroVisual"
            aria-label="Example creator recommendation page"
          >
            <div className="creatorHeroGlow" />
            <div className="creatorPhone">
              <div className="creatorPhoneTop">
                <span />
              </div>
              <div className="creatorPhoneProfile">
                <div className="creatorDemoAvatar">M</div>
                <div>
                  <strong>Maya Cohen</strong>
                  <span>Style, travel &amp; everyday finds</span>
                </div>
              </div>
              <div className="creatorDemoSocials">
                <span>Instagram</span>
                <span>TikTok</span>
                <span>YouTube</span>
              </div>
              <div className="creatorDemoSearch">Search my recommendations...</div>
              <div className="creatorDemoTabs">
                <strong>Latest</strong>
                <span>Fashion</span>
                <span>Favorites</span>
              </div>
              <div className="creatorDemoGrid">
                <article className="creatorDemoCard creatorDemoCardWarm">
                  <button aria-label="Save example product">
                    <Heart size={15} />
                  </button>
                  <div className="creatorDemoProductShape creatorDemoBag" />
                  <p>Everyday shoulder bag</p>
                  <strong>₪189</strong>
                </article>
                <article className="creatorDemoCard creatorDemoCardCool">
                  <button aria-label="Save example product">
                    <Heart size={15} />
                  </button>
                  <div className="creatorDemoProductShape creatorDemoShoe" />
                  <p>My favorite sneakers</p>
                  <strong>₪329</strong>
                </article>
              </div>
            </div>
            <div className="creatorFloatingCard creatorFloatingTop">
              <Palette aria-hidden="true" size={18} />
              <span>
                <strong>Your style</strong>Every color, every detail
              </span>
            </div>
            <div className="creatorFloatingCard creatorFloatingBottom">
              <BarChart3 aria-hidden="true" size={18} />
              <span>
                <strong>Built-in insights</strong>Know what your audience loves
              </span>
            </div>
          </div>
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
            <h2>From recommendation to live page in minutes.</h2>
            <p>
              Spend your time creating. swavii keeps your recommendations organized and
              easy to explore.
            </p>
          </div>
          <div className="creatorStepGrid">
            <article>
              <span>01</span>
              <Plus aria-hidden="true" />
              <h3>Add what you love</h3>
              <p>Collect products, brands and collections in one simple dashboard.</p>
            </article>
            <article>
              <span>02</span>
              <Palette aria-hidden="true" />
              <h3>Make it yours</h3>
              <p>Choose colors, sections and the order that fits your personal brand.</p>
            </article>
            <article>
              <span>03</span>
              <Share2 aria-hidden="true" />
              <h3>Share one link</h3>
              <p>
                Place your public swavii page in any social bio. No visitor account
                needed.
              </p>
            </article>
          </div>
        </section>

        <section className="creatorLandingSection creatorFeatures" id="features">
          <div className="creatorFeatureIntro">
            <p className="creatorLandingEyebrow">EVERYTHING IN ONE PLACE</p>
            <h2>Your taste deserves more than a list of links.</h2>
            <p>
              Create a destination your audience recognizes, trusts and comes back to.
            </p>
            <Link className="creatorTextLink" href={signupHref}>
              Start building <ArrowRight size={15} />
            </Link>
          </div>
          <div className="creatorFeatureGrid">
            <article>
              <LayoutGrid aria-hidden="true" />
              <h3>Flexible recommendations</h3>
              <p>Show individual items, curated collections and complete brand edits.</p>
            </article>
            <article>
              <Palette aria-hidden="true" />
              <h3>A page that feels like you</h3>
              <p>Shape the colors, layout and sections while seeing every change live.</p>
            </article>
            <article>
              <BarChart3 aria-hidden="true" />
              <h3>Useful analytics</h3>
              <p>Understand what gets attention and which recommendations earn clicks.</p>
            </article>
            <article>
              <ExternalLink aria-hidden="true" />
              <h3>Direct paths to products</h3>
              <p>
                Send your audience straight to the exact item or collection they want.
              </p>
            </article>
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
      </main>
      <SiteFooter />
    </div>
  );
}

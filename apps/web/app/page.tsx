import { SiteHeader } from './_components/site-header';

const categories = [
  'Fashion',
  'Beauty',
  'Skincare',
  'Food',
  'Fitness',
  'Lifestyle',
  'Technology',
];

const recommendations = [
  {
    brand: 'RARE BEAUTY',
    className: 'blush',
    code: 'NOA10',
    name: 'Soft Pinch Liquid Blush',
    price: '₪120',
    review: 'המוצר האהוב עליי למראה טבעי וזוהר שנשאר לאורך כל היום.',
  },
  {
    brand: 'LEWODY',
    className: 'serum',
    code: 'GLOW15',
    name: 'Glow Vitamin C Serum',
    price: '₪189',
    review: 'אחרי חודש השימוש העור נראה אחיד יותר ואני אוהבת את המרקם הקליל.',
  },
  {
    brand: 'STUDIO RINA',
    className: 'coat',
    code: 'MAYA20',
    name: 'Oversized Wool Coat',
    price: '₪690',
    review: 'המעיל שמסדר כל לוק בשנייה — גזרה מדויקת ובד נעים במיוחד.',
  },
];

export default function HomePage() {
  return (
    <main>
      <SiteHeader />

      <section className="hero" id="top">
        <div className="heroCopy">
          <p className="eyebrow">4,200+ ISRAELI CREATORS</p>
          <h1>
            Discover what your favorite creators <em>recommend</em>
          </h1>
          <p className="lede">
            Shop authentic recommendations, exclusive discounts and products loved by
            Israeli creators.
          </p>
          <div className="heroButtons">
            <a className="button primary" href="/creators">
              Explore Creators
            </a>
            <a className="button secondary" href="#products">
              Discover Products
            </a>
          </div>
          <dl className="metrics">
            <div>
              <dt>Creators</dt>
              <dd>4.2K</dd>
            </div>
            <div>
              <dt>Recommendations</dt>
              <dd>38K</dd>
            </div>
            <div>
              <dt>Shoppers</dt>
              <dd>1.1M</dd>
            </div>
          </dl>
        </div>
        <div
          className="editorialCollage"
          aria-label="Creator and lifestyle editorial collage"
        >
          <div className="portrait" />
          <div className="beautyStill" />
          <div className="fashionStill" />
          <div className="foodStill" />
        </div>
      </section>

      <section className="categoryBand" id="categories" aria-label="Categories">
        {categories.map((category) => (
          <a href={`/creators?category=${category.toLowerCase()}`} key={category}>
            {category} <span>✦</span>
          </a>
        ))}
      </section>

      <section className="section" id="products">
        <p className="eyebrow">SELECTED PRODUCTS</p>
        <h2>Most saved this month</h2>
        <p className="sectionIntro">
          Real recommendations from creator storefronts, with codes that work.
        </p>
        <div className="productGrid">
          {recommendations.map((item) => (
            <article className="productCard" key={item.name}>
              <div className={`productImage ${item.className}`}>
                <span className="storyBadge">◉ Video</span>
                <span className="codeBadge">{item.code}</span>
              </div>
              <div className="productDetails">
                <p className="brand">{item.brand}</p>
                <h3>{item.name}</h3>
                <p className="price">{item.price}</p>
                <p className="hebrew" dir="rtl" lang="he">
                  {item.review}
                </p>
                <div className="recommendedBy">
                  <span className="storyRing">NL</span>
                  Recommended by Noa Levi
                </div>
                <footer>
                  <span>CODE: {item.code}</span>
                  <a className="button primary small" href="#shop">
                    Shop now
                  </a>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust" id="about">
        <p className="eyebrow">WHY VIBESHUB</p>
        <h2>Built on trust, not on ad budgets</h2>
        <div className="trustGrid">
          <article>
            <span>✓</span>
            <h3>Verified creators only</h3>
            <p>Every storefront is reviewed before it goes live.</p>
          </article>
          <article>
            <span>♡</span>
            <h3>Written by hand</h3>
            <p>Creators write each review in their own words, in Hebrew.</p>
          </article>
          <article>
            <span>◇</span>
            <h3>Codes that work</h3>
            <p>Discount codes are checked so the price you see is the price you pay.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

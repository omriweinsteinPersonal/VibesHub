# VibesHub product and business decisions

**Status:** Accepted as the initial implementation baseline

**Date:** 2026-08-06

**Scope:** Web, iOS, Android, creator studio, shopper accounts, and internal administration

These decisions are the contract that the system architecture, schema, API, and user experience will implement. A material change should be recorded as a new architecture decision rather than silently changing the model.

## 1. Product definition

VibesHub is a curated creator discovery and affiliate marketplace. Israeli shoppers discover products through trusted creator recommendations, Hebrew reviews, short story-style videos, and discount codes.

VibesHub is not an inventory-holding retailer in the first release.

### Accepted

- Shoppers browse VibesHub and complete purchases on an external merchant website.
- VibesHub does not own inventory, create orders, collect product payment, handle fulfilment, or process returns in the first release.
- Every outbound shopping action uses a VibesHub-controlled redirect so attribution and link health can be measured safely.
- The architecture leaves room for merchant feeds and affiliate-network integrations without assuming that they exist initially.

### Explicitly excluded from the first release

- VibesHub checkout and shopping cart
- Seller payouts and split payments
- Inventory reservations
- Order, refund, fulfilment, and returns management
- Paid placement auctions
- Direct messaging between shoppers and creators
- Shopper-authored product reviews

If VibesHub later becomes the merchant of record or processes payments, the order, tax, fraud, payout, refund, and legal architecture must be redesigned before that work starts.

## 2. Monetization baseline

The initial architecture supports revenue from affiliate attribution and commercial agreements with merchants or brands. It does not require shopper checkout or creator payouts.

- Do not implement a paid creator subscription in the native applications in the first release.
- Do not display the screenshot copy claiming a "flat marketplace fee" until the commercial model and responsible payer are explicitly approved.
- Affiliate commission rules must not affect editorial ranking directly.
- Sponsored or commercially influenced content must be distinguishable from organic recommendations.

This keeps the first App Store and Google Play releases focused on physical-product discovery and avoids introducing digital-subscription billing requirements prematurely.

## 3. Accounts and capabilities

A shopper and a creator are not mutually exclusive account types.

- Anyone can browse public creators, recommendations, categories, and trending content without an account.
- A user creates one VibesHub account.
- Every account has shopper capabilities such as saving and following.
- A user can apply for creator capabilities from the same account.
- Creator access is granted only after an application is approved.
- Verification is a separate platform-controlled status and is never self-assigned.
- Moderator and administrator capabilities are independent of creator status.

### Initial authentication methods

- Sign in with Apple
- Google sign-in
- Email magic link
- Email/password only if product testing demonstrates a need for it

Phone OTP is deferred until cost, support, abuse prevention, and Israeli delivery reliability have been validated.

## 4. Creator onboarding and trust

- A creator submits a profile, Hebrew bio, category, social links, and supporting identity/audience information.
- An administrator reviews the application before the public storefront is activated.
- A verified badge means VibesHub performed its defined verification process; it does not mean every product claim is independently endorsed.
- A new creator's initial recommendations are reviewed before publication.
- Established creators may move to post-publication moderation based on trust history.
- Users can report creators, products, recommendations, videos, and discount codes.
- Every moderation action is auditable.

The admin and moderation portal is part of the minimum viable platform, not a later enhancement.

## 5. Catalog ownership model

The catalog uses four distinct concepts:

1. **Product** — the canonical item, such as Rare Beauty Soft Pinch Liquid Blush.
2. **Product offer** — a merchant-specific URL, price, currency, availability, and observation time.
3. **Recommendation** — one creator's Hebrew opinion about a product.
4. **Affiliate link** — the tracked destination used for a specific recommendation or offer.

This separation allows multiple creators to recommend one product while preserving their individual reviews, clips, codes, and attribution.

### Product importing

- Creators may paste a supported merchant URL to create an editable draft.
- Importing never publishes content automatically.
- Initial importing uses an allowlist of supported merchants.
- Structured product data and merchant-specific adapters are preferred over uncontrolled scraping.
- Imported title, brand, image, category, price, and currency remain editable before submission.
- VibesHub stores the source URL, canonical URL, source merchant, extraction method, and observation time.
- The importer must defend against server-side request forgery, redirect abuse, private-network access, oversized responses, and unsupported content types.

## 6. Product images and media rights

- VibesHub does not permanently hotlink third-party product images.
- A published image is copied into VibesHub-controlled storage only when its source and permitted usage are recorded.
- Supported image sources are creator uploads, licensed brand/merchant assets, approved feeds, or another documented permitted source.
- The system stores the original source, rights source, checksum, dimensions, and generated renditions.
- Images are moderated before or shortly after publication according to creator trust level.

## 7. Recommendations and Hebrew content

- The global interface is English and left-to-right.
- Creator bios, recommendations, captions, and code details are primarily Hebrew.
- Hebrew content is stored in full with its locale and rendered in a direction-aware container.
- Product cards visually clamp the recommendation to five lines.
- The database does not truncate reviews to five rendered lines because line count varies by device and typography.
- A detail view can expose the full text through a "Read more" interaction.
- Creators write recommendation content in their own words; VibesHub does not silently generate or replace their review.

## 8. Product-card presentation contract

The shared information hierarchy is:

1. Product image
2. Brand and product name
3. Price and currency
4. Hebrew creator recommendation, clamped to five lines
5. Recommending creator or creator group
6. Circular story-style video preview when available
7. Discount code and copy action when available
8. External "Shop now" action

Web and native implementations may adapt layout and interaction, but they must preserve this hierarchy.

## 9. Video model

- Creators upload video directly to the managed video provider through a short-lived authenticated upload URL.
- A video asset is stored independently from its placement.
- A video can be attached to a recommendation as an ordered story clip.
- A creator can also publish a standalone video with a Hebrew caption and cover image.
- Video processing is asynchronous and has uploading, processing, ready, failed, blocked, and deleted states.
- Feed cards load a thumbnail first. They do not autoplay multiple videos with sound.
- The story viewer starts only after shopper interaction.

## 10. Discount-code truth model

A code is not simply active or inactive. It includes:

- code value
- merchant or brand
- optional product scope
- description and terms
- start and expiration dates
- creator owner
- last verification time
- verification method
- verification status
- visibility status

Initial verification methods may include creator confirmation, administrator confirmation, merchant feeds, affiliate-network data, and automated link checks. Generic automated checkout testing is not assumed to work for every merchant.

- Expired codes are hidden automatically.
- Codes that have not been verified within the configured interval are marked unverified rather than represented as guaranteed.
- The claim "codes that work" may be used only when the UI communicates the last verified date and the operational process is active.

## 11. Price and availability truth model

- Prices are stored as decimal amounts plus ISO currency codes, never as formatted strings.
- Every price includes its source and `observed_at` time.
- Creator-entered special prices are labeled separately from merchant-observed prices.
- The merchant remains the final authority for checkout price and availability.
- Stale prices can be hidden, labeled, or queued for refresh according to policy.
- The marketing statement "the price you see is the price you pay" must not ship without a merchant feed or another enforceable accuracy mechanism.

## 12. Shopper community features

Authenticated shoppers can:

- follow creators
- save products and recommendations
- organize saved items into collections in a later increment
- view recently viewed content
- receive code-expiration, price-change, creator-post, and saved-item notifications when enabled
- report content
- export or delete their account data

Following and saving are private by default.

## 13. Search, feeds, and ranking

The primary public navigation has two discovery paths:

- **Creators** browses people and enters their storefronts.
- **Discover** browses recommendations by product search, category, trending,
  most-saved, or newest order.

Global creator/product search is available from the navigation search control.
Categories and Trending are filters within Discover rather than separate top-level
destinations. A standalone Shoppers marketing page is not part of the current
navigation.

- Search covers creators, products, brands, and categories in English and Hebrew.
- Public lists use cursor pagination.
- Trending is calculated from privacy-conscious engagement signals and recency decay.
- Editorial staff can curate, pin, suppress, or remove content with an audit trail.
- Paid relationships cannot masquerade as organic ranking.
- Public creator and category counts come from production data; screenshot numbers such as 4.2K creators are placeholders until verified.

## 14. Analytics

The creator dashboard reports defined business events:

- storefront visits
- unique visitors
- recommendation views
- story opens and completions
- product saves
- code copies
- outbound shopping clicks
- Instagram/social-profile clicks

Event collection is asynchronous so analytics failure never blocks an outbound merchant redirect. Unique visitors use a documented, privacy-conscious identifier and retention policy.

The first release reports attribution and engagement, not merchant conversion, unless an affiliate network or merchant provides conversion data.

## 15. Mobile and web distribution

- The public website is mobile-first and remains fully usable without installing an application.
- iOS and Android are native Expo/React Native applications, not webview wrappers.
- Public VibesHub URLs support iOS Universal Links and Android App Links.
- If the app is installed, creator and recommendation links open the native destination; otherwise they open the website.
- Creator bulk management is strongest on the responsive web dashboard, while native apps include essential add, edit, publish, video, and analytics actions.

## 16. Privacy, deletion, and security

- Browsing does not require an account.
- Account deletion is available inside both native applications and through the website.
- Personal data has a retention and deletion policy.
- Privileged actions require server-side authorization.
- Administrative and moderation changes are audited.
- Uploads use signed, short-lived URLs.
- Webhooks are signed, replay-protected, and idempotent.
- Public identifiers do not expose sequential internal database identifiers.
- Production data is not copied into development environments.

## 17. Required screen additions

The supplied screenshots are the visual baseline, but implementation also requires designs for:

- mobile navigation and mobile versions of every core flow
- full public creator storefront
- shopper saved, following, notifications, and account areas
- creator application and approval states
- admin and moderation portal
- password recovery or magic-link recovery
- email verification
- account export and deletion
- reporting and blocking
- upload progress and video-processing states
- loading, error, empty, offline, and permission-denied states
- invalid, stale, expired, and unverified price/code states
- circular story viewer behavior

## 18. Decision gates before public launch

The following must be explicitly reviewed before launch even though they do not block the architecture work:

- final revenue contracts and affiliate networks
- terms for using imported merchant images and product data
- creator verification checklist
- moderation service levels
- code-verification interval and displayed language
- price freshness interval and displayed language
- analytics consent and retention policy
- Israeli privacy and foreign-data-transfer review
- App Store and Google Play disclosures

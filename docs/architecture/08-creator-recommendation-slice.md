# Creator recommendation slice

**Status:** Implemented phase 1

**Date:** 2026-08-07

## Scope

This slice delivers the first end-to-end creator publishing path while preserving the accepted architecture:

- the Next.js web app is a client of the shared NestJS API;
- the NestJS API exclusively owns application-domain reads and writes;
- PostgreSQL in Supabase remains the source of truth; and
- the worker is not required for the synchronous draft, publish, and storefront path.

It adds canonical brands, merchants, products, merchant offers, and creator recommendations in the private `app` schema. Public storefront reads return published recommendations only. Creator mutations require the `creator:manage_content` capability, verify ownership, use idempotency for commands, and use `If-Match` for optimistic concurrency.

## Phase 1 decisions

- Product and merchant identities are canonical so many creators can recommend the same product without copying catalog data.
- Price is stored internally as integer minor units with an ISO currency code. This avoids floating-point and rounding ambiguity; the public representation can evolve behind the API boundary without a database rewrite.
- Recommendation reviews are Hebrew and creator-owned. The UI limits their presentation to five lines without truncating the stored review.
- Recommendation image, story cover, and story video URLs are presentation fields on the recommendation for this slice.
- Discount code and label fields are temporarily attached to a recommendation. They will move to the normalized discount-code model when validation, expiry, and many-to-many product scope are implemented.
- Outbound shopping now uses the tracked `/go/{publicId}` endpoint and exact merchant-domain allowlist described in `10-tracked-outbound-shopping.md`. Creator management responses retain the original product URL separately so editing cannot turn VibesHub's redirect URL into a merchant offer.

## Deliberate boundaries

ADR-005 remains accepted. The temporary image-URL input has been superseded for new Creator Studio content by the controlled upload flow in `09-recommendation-image-media.md`; legacy fixture URLs remain compatible during migration. Mux video processing, media moderation, and controlled renditions remain required before broad creator onboarding.

ADR-006 remains accepted as amended. The API is a separate NestJS Vercel project in `fra1`, shared by web and mobile, and has not been moved into Next.js Route Handlers. Runtime traffic uses the Supavisor transaction pooler with prepared statements disabled. The worker remains intentionally undeployed.

## Verification

- Shared contracts, API unit tests, workspace lint, TypeScript checks, and production builds pass.
- Desktop and mobile browser checks cover the creator editor and public storefront card, including image-first layout, story treatment, RTL review text, five-line clamp, discount code, disclosure, and outbound shop link.
- Production migrations were applied without fixture data. Seven active categories and nine reserved handles remain present.
- The new private tables have RLS enabled and no client-role grants. A transactional draft-to-published smoke test was rolled back after its assertions passed.
- Merchant domains and tracked links are private, fail closed, and were verified in production with a rolled-back allow/activate/disable acceptance transaction.

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
- Outbound shopping currently uses the validated HTTPS offer URL. The tracked `/go` redirect and merchant-domain allowlist remain a later security and analytics slice.

## Deliberate boundaries

ADR-005 remains accepted. Phase 1 accepts HTTPS media URLs so the publishing and storefront domain can be exercised without committing to incomplete upload plumbing. Direct signed image uploads, Mux video processing, media moderation, renditions, and provider-owned asset identifiers must replace these inputs before broad creator onboarding.

ADR-006 remains accepted. The API is still a separate NestJS service intended for Cloud Run in `europe-west3`; it has not been moved into Next.js Route Handlers. Production API and worker deployment are intentionally deferred while Google Cloud billing is disabled. Until the API is deployed and `NEXT_PUBLIC_API_URL` is configured, the production web app must display its existing unavailable state rather than access private Supabase tables directly.

## Verification

- Shared contracts, API unit tests, workspace lint, TypeScript checks, and production builds pass.
- Desktop and mobile browser checks cover the creator editor and public storefront card, including image-first layout, story treatment, RTL review text, five-line clamp, discount code, disclosure, and outbound shop link.
- Production migrations were applied without fixture data. Seven active categories and nine reserved handles remain present.
- The new private tables have RLS enabled and no client-role grants. A transactional draft-to-published smoke test was rolled back after its assertions passed.

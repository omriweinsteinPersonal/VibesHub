# Creator content management

**Status:** Implemented phase 1

**Date:** 2026-08-07

## Scope

This slice completes the synchronous creator workflow for managing recommendation
cards without changing the accepted deployment or media architecture.

- Creators create drafts with a controlled product-image upload, catalog details, a
  Hebrew review, optional discount code, commercial disclosure, and an optional
  story-preview URL.
- Drafts and published cards can be edited with optimistic concurrency.
- Cards can be published, unpublished, reordered, archived, and restored.
- Published storefronts use the creator's explicit integer position instead of
  publication time.
- Archiving removes the card and its outbound link from public traffic without
  deleting product, review, attribution, save-source, or audit history.

## Ordering and concurrency

Each active recommendation has a non-negative `position`. Existing rows are
normalized once by migration. A new draft is appended after the creator's current
active cards. Moving a card swaps it with one adjacent active card.

Create, move, and restore transactions lock the owning creator-profile row. This
serializes position allocation for one storefront while allowing unrelated creators
to write concurrently. The moved card and its neighbor both receive new versions.
Every mutation still requires the current strong `If-Match` version; command routes
also use idempotency keys.

The cursor contains the last position and UUID, plus an archived partition marker
for the private management collection. Public cursors are scoped to a creator handle
and cannot be reused on another storefront.

## Archive lifecycle

```text
draft <-> published
  |          |
  +--> archived --restore--> draft (appended last)
```

Archiving also changes the recommendation's affiliate link to `archived`, so an old
tracked URL fails closed. Restoring changes that link to `blocked`; the creator must
publish again, and publication still requires an approved merchant domain.

## Media boundary

Product images continue to use the controlled Supabase Storage quarantine and
validation flow from `09-recommendation-image-media.md`.

ADR-005 remains accepted. The current story preview is only compatibility metadata
behind `DeferredVideoPreviewProvider`; it is not presented as a managed upload.
Direct Mux upload, processing, thumbnails, moderation, and webhook handling remain a
separate slice and should not be simulated with public bucket uploads. The worker
remains undeployed.

## Security

- The NestJS API remains the only application-domain database client.
- Creator capability and resource ownership are checked for every read and write.
- Archived records remain private and are excluded from public storefront queries.
- The private recommendation table retains RLS with no `anon` or `authenticated`
  grants.
- Merchant-domain approval is still required before a recommendation can publish.

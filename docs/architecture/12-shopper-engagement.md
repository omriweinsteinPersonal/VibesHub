# Shopper engagement slice

**Status:** Implemented phase 1

**Date:** 2026-08-07

## Scope

This slice adds the authenticated community loop for shoppers without changing the
accepted deployment architecture:

- shoppers can save a product from a published recommendation;
- shoppers can follow an approved, published creator;
- private Saved Products and Following pages are cursor paginated;
- one bounded engagement-state request hydrates all controls on a storefront page; and
- the shared NestJS API remains the only application-domain database boundary for web
  and future mobile clients.

## Data decisions

- `app.saved_products` is unique by `(user_id, product_id)`, so the same canonical
  product cannot be duplicated when multiple creators recommend it.
- `source_recommendation_id` preserves the creator context that caused a save while
  allowing the saved product to fall back to another currently shop-able published
  recommendation if the original becomes unavailable.
- `app.creator_follows` is unique by `(user_id, creator_id)`.
- Both collections use `(user_id, created_at desc, entity_id desc)` indexes for stable
  keyset pagination and reverse indexes for future product and creator aggregates.
- Both tables remain in the private `app` schema, have RLS enabled as defense in depth,
  and grant no direct access to browser roles.

## API decisions

- `PUT` and `DELETE` mutations are naturally idempotent through unique constraints and
  delete-if-present semantics.
- `POST /v1/me/engagement-state` accepts at most 48 creator IDs and 48 product IDs so a
  rendered page can hydrate all controls without an N+1 request pattern.
- Reads require `shopper:read`; mutations require `shopper:save`.
- Save attribution is accepted only when the supplied recommendation belongs to that
  product and is currently published behind an approved merchant domain.

## UX decisions

- Public storefronts stay server-rendered; only the Follow and Save controls cross the
  client boundary.
- Mutations update optimistically, roll back on failure, and return unauthenticated
  shoppers to the storefront after login.
- Product cards retain image-first ordering and the five-line Hebrew review clamp.

## Deliberate boundaries

This phase does not deploy the worker, send notifications, modify trending scores, or
change creator social-audience counts. Those capabilities consume engagement data in a
later analytics and notification slice.

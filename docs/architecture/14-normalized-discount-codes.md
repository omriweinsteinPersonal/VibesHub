# Normalized discount-code management

Status: implemented on 2026-08-07.

## Outcome

Creators manage discount codes independently from recommendation cards. One code can
be placed on multiple recommendations, has a real validity window, and keeps an
immutable verification history. Public responses show only codes that are published,
currently valid, and backed by an accepted verification state.

## Data ownership and security

- `app.discount_codes` is the source of truth for merchant, code, Hebrew details,
  validity, lifecycle, and verification state.
- `app.recommendation_discount_codes` controls ordered placement on product cards.
- `app.discount_code_products` reserves explicit product scope for a later release.
- `app.discount_code_verifications` records every confirmation as append-only history.
- All four tables live in the private `app` schema. RLS is enabled and both `anon` and
  `authenticated` have no table privileges. The NestJS API remains the only application
  data-access boundary for web and mobile.

Legacy discount fields remain on recommendations during the transition. Creating or
editing a legacy embedded code synchronizes it into the normalized model; all public
projections prefer the normalized placement.

## Lifecycle and truth rules

1. A creator creates a draft for an approved HTTPS merchant domain.
2. `POST /v1/creator/discount-codes/{id}/confirm` records a creator-confirmation event,
   stamps `last_verified_at`, and publishes the code.
3. Editing a published code returns it to draft and clears its prior verification so
   changed terms cannot inherit an old confirmation.
4. Hidden and archived codes are excluded immediately.
5. Codes outside `starts_at` and `expires_at` are excluded at read time. This is safe
   before the worker exists; the future expiry job will make lifecycle state converge.
6. Creator confirmations older than 30 days are returned as `stale` and are not shown
   publicly. Staff and merchant verification are deliberately separate future states.

## API surface

Creator endpoints require `creator:manage_content`; mutations use ownership checks,
optimistic concurrency through `If-Match`, and idempotency keys where commands can be
retried.

- `GET|POST /v1/creator/discount-codes`
- `GET|PATCH /v1/creator/discount-codes/{id}`
- `POST /v1/creator/discount-codes/{id}/confirm`
- `POST /v1/creator/discount-codes/{id}/hide`
- `POST /v1/creator/discount-codes/{id}/archive`
- `GET /v1/creators/{handle}/discount-codes`

The creator dashboard exposes create, edit, confirm/publish, hide, and recoverable
archive controls. The public storefront has a Current offers section, while product
cards display their attached code, verification label, and expiry when available.

## Deferred work

- staff and merchant verification workflows;
- explicit product-scope editing;
- scheduled lifecycle convergence and automated validation in the worker;
- code-copy analytics and notification events.

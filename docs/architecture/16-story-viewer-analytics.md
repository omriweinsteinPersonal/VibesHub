# Recommendation story viewer and analytics

## Scope

This slice replaces external-tab video preview navigation with a first-party story
viewer on product recommendation cards. It deliberately uses the existing HTTPS
preview URL compatibility field; controlled Mux upload, processing, moderation,
and provider-backed placement remain the next media slice under ADR-005.

## Shopper experience

- The recommendation image remains the first and dominant card element.
- A circular story control appears over the image only when a video preview exists.
- Activation opens a vertical, mobile-first modal without autoplaying feed cards.
- The viewer supports native playback controls, inline mobile playback, Escape and
  backdrop close, focus containment/restoration, background scroll locking, and a
  recoverable link when embedded playback fails.
- Hebrew recommendation text remains below the image and is clamped to five lines.

## Analytics contract

The viewer emits two bounded version-1 client events:

- `story.opened` when a shopper intentionally opens a recommendation video.
- `story.completed` once playback reaches at least 90%, with duration and watched
  milliseconds bounded to 15 minutes.

The API validates each event against the published recommendation, creator, and
product relationship before storage. Event identifiers remain idempotent, viewer
identifiers remain one-way hashed, and invalid analytics never block playback.

Daily creator and recommendation projections now include story opens and story
completions. Creator Studio exposes both totals and per-recommendation values.

## Deferred controlled-upload work

ADR-005 remains accepted. The following slice will replace compatibility URLs for
new uploads with Mux direct-upload authorizations, signed idempotent webhooks,
processing/moderation states, provider identifiers, thumbnails, adaptive playback,
and safe deletion. It requires a Mux environment and credentials and does not
require deploying the worker for the initial webhook-driven lifecycle.

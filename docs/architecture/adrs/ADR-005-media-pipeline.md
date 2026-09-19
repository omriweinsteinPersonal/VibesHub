# ADR-005: Managed image and video pipeline

**Status:** Accepted

**Date:** 2026-08-06

## Context

Swave's experience depends on large product images, creator profile media, story-style video, upload progress, thumbnails, and efficient mobile delivery. Routing large uploads through application servers would waste compute and make retries fragile.

## Decision

- Use Supabase Storage for images and image metadata ownership in PostgreSQL.
- Upload from clients directly with short-lived signed authorization.
- Keep originals private unless public access is required.
- Generate and publish controlled renditions for supported display sizes and formats.
- Use Mux for direct video upload, processing, thumbnails, and adaptive playback.
- Store Swave video ownership, status, moderation, and placement separately from Mux asset identifiers.
- Validate signed media webhooks and process them idempotently.

## Consequences

- API instances do not proxy large uploads.
- Upload and processing state is asynchronous and must be reflected in creator UI.
- Video delivery, transcoding, and playback observability are delegated to a specialist provider.
- Provider cost and outage behavior must be monitored.
- Media deletion requires coordinated deletion of Swave records and provider assets.

## Rejected alternatives

### Store video files as ordinary application objects only

Rejected because adaptive streaming, transcoding, thumbnails, device compatibility, and playback metrics would become Swave infrastructure responsibilities.

### Accept only externally hosted video URLs

Rejected because ownership, availability, privacy, playback behavior, and moderation would be unreliable.

### Upload through the API

Rejected because large-file transfer should not consume general application compute or request timeouts.

## Revisit when

- Media scale makes a different provider materially more economical,
- Required media capabilities are unavailable, or
- Contractual/data-residency requirements require another delivery model.

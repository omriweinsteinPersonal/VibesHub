# Creator profile settings

**Status:** Implemented phase 1

**Date:** 2026-08-08

## Scope

Approved creators can edit the public identity of their storefront from the creator
studio. The editable fields are the profile image, display name, primary category,
Hebrew bio, and supported social links. The public creator directory, storefront,
and shopper follow collection consume the same projection.

The public handle is intentionally read-only. Changing it would invalidate shared
storefront URLs and requires a future rename workflow with reservations, redirects,
and an audit trail. Verification and follower counts remain staff- or system-owned
trust signals.

## Mutation contract

The NestJS API exposes `GET /v1/creator/profile` and
`PATCH /v1/creator/profile`. Both require the `creator:manage_profile`
capability. Updates use a strong `If-Match` version and return `412` for stale
writes. The API validates category state, social-link shape and uniqueness, creator
ownership of the selected media asset, and asset readiness before committing the
change.

Profile data, social links, the primary category relation, and the incremented
version are written in one transaction. Each successful mutation records a
`creator_profile.updated` audit entry containing only field names and version
metadata, not profile text.

## Profile-image lifecycle

Profile images reuse the controlled image pipeline defined in
`09-recommendation-image-media.md`: private quarantine upload, server-side content
validation, and promotion into the verified public bucket. The profile stores the
verified media-asset ID rather than accepting an arbitrary image URL.

An attached avatar counts as a live media reference and cannot be deleted. When a
creator successfully replaces or removes an avatar, the web client requests cleanup
of the previous unreferenced asset. Abandoned staged uploads are also cleaned up on
replacement or page exit.

## Security boundary

- The browser never writes profile tables directly.
- The API derives the creator from the authenticated Supabase JWT and checks
  capability and row ownership.
- Application tables remain private behind the NestJS API.
- Public projections expose only published creator identity fields and verified
  media URLs.
- The worker remains undeployed and is not part of this synchronous slice.

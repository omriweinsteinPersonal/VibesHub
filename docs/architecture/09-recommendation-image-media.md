# Recommendation image media slice

**Status:** Implemented phase 1

**Date:** 2026-08-07

## Scope

This slice replaces manually entered image URLs in Creator Studio with a controlled direct-upload flow while preserving ADR-005 and ADR-006.

- Supabase Storage carries image bytes.
- The private `app.media_assets` table carries VibesHub ownership, lifecycle, declared metadata, verified metadata, and provider placement.
- The shared NestJS API authorizes every upload, completion, attachment, and deletion.
- The browser uploads directly to one server-generated object path and never receives the Supabase server secret.
- Recommendation and product rows reference the VibesHub asset identity rather than a provider management identifier.

## Access model

Uploads first land in the private `recommendation-image-uploads` quarantine bucket. The signed upload token grants access only to the API-selected object path; the bucket has no client policies. After validation, the API writes the verified bytes to the public `recommendation-images` delivery bucket and removes the quarantine object.

The delivery bucket is public because published product imagery is public storefront content and should use cacheable CDN delivery. Public access permits reads only. The bucket has no client upload, update, or delete policies, so unvalidated uploads are never publicly readable.

The API uses a server-only Supabase service-role key to issue a signed upload token for exactly one generated path:

```text
{ownerUserId}/{mediaAssetId}.{typeDerivedExtension}
```

Both buckets accept only JPEG, PNG, and WebP files up to 5 MB. The API downloads the first bytes from quarantine and verifies the file signature, exact declared size, ownership, and pending asset state before publishing the object and marking the asset ready. A URL or browser-supplied MIME type alone is never treated as proof of valid image content.

## Lifecycle

```text
pending_upload -> ready -> deleted
       |
       +-------> failed
```

Only a ready asset owned by the authenticated creator can be attached to a recommendation. Referenced assets cannot be deleted. Failed files are removed from Storage and cannot be attached. The future worker may clean up expired pending uploads, but it is not required for the synchronous upload and completion path.

## HTTP API

- `POST /v1/creator/media/images/uploads` creates the asset and returns one signed upload token.
- `POST /v1/creator/media/images/{id}/complete` validates the stored bytes and returns the ready asset.
- `DELETE /v1/creator/media/images/{id}` removes an unreferenced owned asset.

Create and completion commands require idempotency keys. Every route requires `creator:manage_content`; object ownership is checked again in the database.

## Compatibility and deferred work

Existing development fixtures and legacy recommendations may retain an HTTPS `image_url`; new Creator Studio content uses `image_asset_id`. The database requires exactly one source during this transition.

Video remains an HTTPS preview URL behind a provider interface. Direct Mux uploads, transcoding, thumbnails, moderation, webhook handling, and abandoned-upload cleanup remain deferred until the API and worker are deployed.

The API requires `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable. It must never be exposed through a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.

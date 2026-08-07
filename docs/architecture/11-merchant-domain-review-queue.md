# Merchant-domain review queue

**Status:** Implemented

**Date:** 2026-08-07

## Purpose

Creator product links introduce external merchant hostnames. A creator may request
one by saving a recommendation, but cannot authorize it. The operations queue gives
administrators one place to discover, verify, approve, reject, reapprove, or disable
those exact hostnames before any shopper redirect becomes active.

## Lifecycle

```text
pending ──approve──> approved ──disable──> disabled
   │                    ▲                     │
   └────reject────> rejected ───approve──────┤
                         └────────────────────┘
                                  approve
```

- `pending` has no permissions, verification time, reviewer, or note.
- `approved` grants at least one of import or redirect permission and records a
  verification time.
- `rejected` grants no permissions and clears any verification time.
- `disabled` grants no permissions but retains the historical verification time.
- Disabling a domain synchronously blocks its active and unhealthy affiliate links
  through the existing database trigger.
- Reapproving a domain reactivates only blocked links whose recommendation, creator,
  offer, product, and merchant are all still public and active; unhealthy or archived
  links are never resurrected.

Database check constraints enforce these invariants independently of the API.

## API and concurrency

The shared NestJS API exposes an oldest-first, cursor-paginated administrator queue.
The cursor is bound to its status filter, so it cannot be reused across tabs.
Decision commands require `admin:manage_platform`, `Idempotency-Key`, and `If-Match`
with the current positive row version. The repository takes a short row lock,
validates both version and lifecycle, updates the state, and appends an audit entry
in one transaction.

The response never exposes merchant credentials or private destination URLs.

## Web interface

`/admin/merchant-domains` is a mobile-first authenticated client workflow. It uses
the same API contract future iOS and Android clients can consume. Administrators can
filter the four states, inspect affected recommendation and creator counts, record
internal evidence, grant the separate import permission, and make version-checked
decisions.

The interface calls the standalone NestJS API deployed independently from the web
application. No Next.js Route Handler, worker, or Google Cloud resource owns the
review workflow.

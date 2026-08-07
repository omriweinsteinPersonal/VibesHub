# ADR-002: API-first modular monolith

**Status:** Accepted

**Date:** 2026-08-06

## Context

Web and native clients require the same business rules. VibesHub also has cross-cutting workflows involving creators, catalog records, recommendations, codes, media, moderation, affiliate links, and analytics.

Implementing core writes inside the Next.js application would couple the backend to one client. Starting with microservices would add deployment, networking, data-consistency, and observability complexity before load or team boundaries justify it.

## Decision

- Build a versioned REST API in TypeScript using NestJS with the Fastify adapter.
- Publish an OpenAPI specification and generate client types for web and native.
- Organize the backend as a modular monolith with explicit module ownership.
- Deploy the stateless API as a separate Vercel Node.js Function project, independent of the Next.js web project's lifecycle and shared by web and mobile clients.
- Run asynchronous handlers in a separately scalable worker application.
- Keep domain rules independent of HTTP, database, queue, and vendor SDKs where practical.

## Consequences

- Web and native use one authoritative behavior model.
- API instances scale horizontally.
- Transactions across closely related modules remain straightforward.
- Module boundaries require review and enforcement inside one repository.
- A future service extraction can reuse contracts and domain boundaries but will still require operational work.

## Rejected alternatives

### Next.js route handlers as the complete backend

Rejected as the long-term boundary because the native application, workers, import pipeline, webhooks, and operational tooling should not depend on the web deployment lifecycle.

### GraphQL

Rejected initially because the main use cases map cleanly to commands and cursor-paginated resources. REST/OpenAPI provides simpler caching, authorization review, observability, and generated clients.

### Microservices

Rejected until independently scaling or owning a module produces a measured benefit greater than the operational cost.

## Revisit when

- One module has materially different availability or scaling requirements,
- Separate teams require independent deployment ownership, or
- Regulatory or security isolation requires a harder boundary.

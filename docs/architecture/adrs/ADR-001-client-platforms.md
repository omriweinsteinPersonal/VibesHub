# ADR-001: Separate optimized web and native clients

**Status:** Accepted

**Date:** 2026-08-06

## Context

VibesHub requires indexable editorial storefronts, social sharing, responsive mobile web, App Store and Google Play distribution, deep links, native media uploads, push notifications, and platform-quality navigation.

A single rendered UI across web, iOS, and Android would maximize superficial code sharing but constrain either the public web experience or native application quality.

## Decision

- Build the web application with Next.js and deploy it on Vercel.
- Build iOS and Android with Expo and React Native.
- Use Expo Router for native navigation and deep-link mapping.
- Share API contracts, domain validation, design tokens, analytics definitions, and non-visual utilities.
- Allow platform-specific UI components and layouts.
- Treat mobile web as a first-class Next.js responsive experience, not a redirect to an app-install page.

## Consequences

- Public pages can use server rendering, caching, metadata, sitemaps, and social preview images.
- Native apps can use native navigation, secure storage, camera, media picker, uploads, push notifications, and app links.
- Web and native teams must maintain two presentation implementations.
- Visual consistency comes from tokens, documented component behavior, and cross-platform acceptance tests rather than one universal component library.
- Core business logic cannot live only in Next.js Server Actions or browser state.

## Rejected alternatives

### Expo Web for the complete platform

Rejected because public creator and product discovery requires web-first rendering, metadata, accessibility, caching, and editorial layout control.

### Webview or thin native wrappers

Rejected because creator uploads, navigation, app-link behavior, performance, and store-quality user experience require real native applications.

### Flutter for web and native

Rejected for this product because the public web and React/Next ecosystem are stronger architectural drivers than sharing a single rendering layer.

## Revisit when

- The native application becomes unnecessary based on validated usage, or
- A future platform technology demonstrably satisfies the web SEO/editorial and native-quality requirements with lower total cost.

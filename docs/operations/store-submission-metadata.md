# Store submission metadata

This document is the human-reviewed source for store-console fields that cannot safely be
submitted from the repository. `apps/mobile/store.config.json` contains the non-sensitive
Apple listing copy supported by EAS Metadata. Google Play listing fields remain manual
because EAS Metadata currently supports only the Apple App Store.

## Product positioning

- App name: **Swavii**
- Default language: **English (U.S.)**
- Suggested category: **Lifestyle**
- Audience: adults browsing creator recommendations and adult creators managing their
  accounts
- Business model for the first release: free; no paywall or subscription is exposed
- Products shown in storefronts are sold by independent merchants, not by Swavii

## Google Play listing copy

### Short description

Authentic creator recommendations, useful products and discount codes.

### Full description

Discover authentic product recommendations from creators you trust. Browse public creator
storefronts, explore the products they genuinely use, find discount codes, and open product
links directly from one focused place.

Creators can sign in to manage their Swavii account and continue to the creator studio.
Shoppers can browse without creating an account.

Swavii does not sell the products shown in the app. Purchases take place directly with
independent merchants.

### Public URLs

- Website: `https://swavii.com`
- Support: `https://swavii.com/support`
- Privacy policy: `https://swavii.com/privacy`
- Account deletion: `https://swavii.com/account-deletion`
- Terms: `https://swavii.com/terms`

## Review notes template

Replace every bracketed value before submission. Do not commit real reviewer credentials.

> Swavii lets visitors browse public creator storefronts without an account. Open the app
> and select “Explore creators” to test the public experience. Creator-only features are
> available from Account. Review credentials: [REVIEW EMAIL] / [REVIEW PASSWORD]. The
> account is preconfigured as an approved creator with published recommendations. Account
> deletion is under Account → Delete account. Sign in with Apple and Google are available
> on iOS; Google and email/password are available on Android. The first release is free and
> does not expose purchases or a paywall. External product links open independent merchant
> sites. Tested devices and OS versions: [DEVICES AND VERSIONS]. Support contact:
> [NAME, PHONE, EMAIL].

## Apple App Privacy working sheet

The App Store answers must describe the shipped binary, backend, and all enabled third-party
SDKs. Reconfirm these answers immediately before submission.

Likely collected data for creator accounts:

- Contact info: name and email, linked to the user, for app functionality and account
  management.
- User content: profile content, recommendations, images and videos, linked to the user,
  for app functionality.
- Identifiers: internal user/account ID, linked to the user, for app functionality and
  security.
- Usage data: storefront and recommendation interactions, used for analytics and app
  functionality. Anonymous shopper events are not intentionally linked to identity.
- Diagnostics/security logs: disclose them if the production hosting or monitoring setup
  retains crash, performance, device, or network information.

Do not declare tracking unless the release begins linking data across other companies' apps
or websites for advertising or measurement. Re-evaluate the form before enabling a new
analytics, attribution, advertising, crash-reporting, or payments SDK.

## Google Play Data safety working sheet

Reconfirm every declaration against the production release and current Google definitions.

- Data is encrypted in transit: **Yes**.
- Users can request deletion: **Yes**.
- In-app deletion path: Account → Delete account.
- Web deletion resource: `https://swavii.com/account-deletion`.
- Account data and public creator content are collected for app functionality and account
  management.
- Storefront interaction events are collected for analytics and app functionality.
- The app does not sell personal data and the first release contains no advertising SDK.
- Review Supabase, Google sign-in, Apple sign-in, RevenueCat, Vercel, and any newly enabled
  monitoring provider when answering the service-provider/data-sharing questions.

## Assets and console-only work

- Capture screenshots from the exact release candidate on current iPhone and Android phone
  sizes. Do not use the desktop phone-frame preview.
- Create the Google Play 1024 × 500 feature graphic and verify the 512 × 512 Play icon.
- Complete the content/age rating questionnaires based on actual public creator content.
- Add a non-expiring approved-creator review account in both consoles.
- Enter the legal seller/developer name exactly as registered in the Apple and Google
  accounts. Do not invent a company name before the Israeli business entity is finalized.
- Verify the public support mailbox from an unrelated email account.

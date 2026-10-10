# Repository-wide product rules

These instructions apply to the entire repository. More specific `AGENTS.md` files may
add framework-specific requirements, but they do not replace these product rules.

## Mobile web and native parity

**Golden rule:** every user-facing feature and change must account for responsive
mobile web, Android, and iOS before it is considered complete. A change may use
platform-specific implementation or UX, but none of the three surfaces may be skipped
silently.

This rule is bidirectional. A change that starts in `apps/web` must evaluate and update
the iOS and Android experiences when the same journey exists there. A change that starts
in `apps/mobile` must evaluate and update responsive mobile web when the same journey
exists there. Backend, contract, authentication, analytics, billing, deep-link, and data
model changes must be verified against all three clients.

Every user-facing feature, behavior change, bug fix, and design change must be evaluated
for both of Swavii's user-facing mobile surfaces:

- responsive mobile web in `apps/web`;
- the Expo/React Native application in `apps/mobile` on both iOS and Android.

Before implementation:

1. Identify the affected journeys on mobile web and native.
2. Decide what can be shared through contracts, domain logic, API behavior, design
   tokens, copy, or analytics events.
3. Include the required work for both surfaces in the same change whenever the feature
   is available on both.

During implementation:

- Do not treat a desktop layout or an Expo web preview as proof that the native app is
  correct.
- Keep API contracts, permissions, validation, loading, empty, error, and success states
  behaviorally consistent across mobile web and native.
- Use platform-appropriate UI when interaction conventions differ; parity means the same
  capability and quality, not necessarily identical components.
- Check touch targets, safe areas, keyboard behavior, deep links, authentication,
  accessibility, slow networks, and small-screen layout where relevant.

Before completion:

- Test the affected mobile-web flow at a phone-sized viewport.
- Test the affected native flow on iOS and Android, or run the strongest available Expo
  validation when device builds are not available.
- Add or update automated tests for shared logic and platform-specific behavior.
- Complete the pull request's cross-platform impact section for Mobile Web, iOS, and
  Android. For every surface, record either the implementation/tests performed or a
  concrete reason why no code change is required.
- Report the platforms tested and any remaining limitation in the pull request.

A deliberately platform-specific change is allowed only when the product requirement or
platform capability demands it. Document the reason and the follow-up/parity decision in
the pull request; never leave the other surface unconsidered.

## Baseline verification

Run the narrow checks for every package changed. For cross-platform feature work, the
minimum checks are:

```bash
pnpm --filter @vibeshub/web lint
pnpm --filter @vibeshub/web typecheck
pnpm --filter @vibeshub/web test
pnpm --filter @vibeshub/mobile lint
pnpm --filter @vibeshub/mobile typecheck
pnpm --filter @vibeshub/mobile test
```

Run `pnpm check` and `pnpm build` before merging when the local environment supports the
full workspace.

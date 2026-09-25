<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mobile-first product UI

- Treat mobile web as the primary experience for shopper-facing and creator-facing flows.
- Verify UI changes at 360 px and 390 px widths before considering them complete, then confirm the desktop layout still works.
- Never require horizontal scrolling to read a title, price, control, or form field. Horizontal rails may scroll, but each visible card must keep its leading text inset and readable.
- Prefer stable, compact layouts over adding loading screens or decorative UI that creates extra motion on fast transitions.

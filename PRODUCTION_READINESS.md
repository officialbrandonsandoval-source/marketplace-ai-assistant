# PONS Extension Production Readiness

This repo is the current Chrome extension source candidate for the PONS Marketplace product.

## Blocking Issues

1. Product naming still says `Facebook Marketplace AI Assistant`; production should say PONS and match `pons.solutions`.
2. The manifest still includes localhost and the old Render backend host. Production builds should only include the production API origin.
3. The extension currently waits on backend job creation plus polling for user-visible results. That cannot feel instant.
4. The UI is still reply-assistant oriented. The public website promises deal grading, projected spread, signals, and alerts.
5. Shared plan limits and deal signal types are duplicated or absent. They should come from the monorepo `@pons/shared` package once the code is moved.

## Required Production Shape

- Manifest V3 service worker remains the background runtime.
- Content script extracts listing snapshots immediately and renders a local signal before calling the API.
- API enrichment runs after the local signal and updates the UI when complete.
- Repeated requests for the same listing/context must reuse cached or in-flight work.
- User actions remain human controlled. No auto-send, no hidden Facebook actions.

## Latency Target

| Stage | Target |
| --- | --- |
| Listing extraction | under 50 ms after DOM is stable |
| Local grade render | under 100 ms after extraction |
| Cached result render | under 150 ms |
| API enrichment | non-blocking; update when available |
| LLM/slow analysis | never block the first visible signal |

## Migration Target

Move this extension into `officialbrandonsandoval-source/pons-api` at `apps/extension`, then wire it to:

- `packages/shared/src/marketplace.ts` for deal signal contracts.
- `apps/api` for enrichment and plan enforcement.
- `apps/web` for upgrade and account flows.

## First Code Changes To Wire

1. Add a request cache in the background service worker.
2. Compute a stable cache key from listing id, title, price, last message timestamp, and selected controls.
3. Return cached suggestions immediately when fresh.
4. Coalesce duplicate in-flight requests so multiple UI clicks do not create multiple backend jobs.
5. Replace fixed 1000 ms polling with a short initial poll cadence and backoff.

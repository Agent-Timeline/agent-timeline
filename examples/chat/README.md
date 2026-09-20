# Standalone chat example

A small, independent web app showing how to consume Agent Timeline's simulated provider. It uses plain TypeScript and browser DOM APIs, with no workbench UI imports, authentication, database, or live model. All content is synthetic.

## Start from a fresh checkout

Requirements: Node.js 22.12 or newer. From the Agent Timeline repository root:

```sh
npm ci
npm run dev:backend
```

In a second terminal:

```sh
npm run dev:example
```

Open http://127.0.0.1:4319. The provider runs on port 4318. If `npm run dev` is already running, its provider is sufficient; do not start a second backend on the same port.

1. Choose Fixed or Buggy request handling.
2. Send a prompt. Output is scripted regardless of prompt content.
3. Cancel before the second chunk arrives at 1100 ms.
4. Compare the response and event log. Fixed mode ignores the late result. Buggy mode demonstrates the defect.
5. Reset to clear the run and abort any pending delivery.

Send is disabled until transport finishes, even after cancellation. This example covers one outstanding request; overlapping retries are covered separately in the gallery.

## Current milestone

The example connects to the provider, but the workbench timeline does not yet control this app. Its scenario is defined in `main.ts`; its event log appears inside the example. The next integration milestone is to run an edited workbench scenario against this app and return verification results to the workbench.

## How the connection works

```text
Example chat browser :4319
        | POST /timeline/api/generate
        v
Example Vite server (development proxy)
        | POST /api/generate
        v
Agent Timeline provider :4318
```

`main.ts` imports `createTimelineProvider` from `../../client/provider`. This is a source import within the checkout, not a published npm SDK. It sends a synthetic version-1 scenario and consumes typed events through async iteration. The example's own app logic owns the rendered response, loading state, request identity, and cancellation.

`vite.config.ts` configures the same-origin streaming proxy. To change the provider port, set `TIMELINE_PROVIDER_PORT` consistently for the backend and example processes. The backend does not serve this app; the workbench need not run.

Cancellation invalidates the active request without closing transport, deliberately exposing late arrivals. Reset and leaving the page abort transport. No cancellation acknowledgement is fabricated. The scenario's `cancelAtMs` is metadata; the example does not automatically click Cancel. The browser test performs the real click.

## Automated checks

From the repository root:

```sh
npx playwright install chromium
npm run test:example
```

Tests start a fresh provider on port 4438 and example on 4439; those ports must be free. They observe response mutations after cancellation, prove buggy mode exposes the late text and fixed mode rejects it, and verify reset and a subsequent successful request. They do not call a live model.

`npm run verify` includes the example's type checking, build, and tests. `npm run build:example` writes `dist/example-chat`; hosting that output requires equivalent API routing because Vite's development proxy is not included in static files.

## Using this as a starting point

Keep your app's real rendering and state handling, adapt the client calls and development proxy to your environment, and retain app-specific configuration in your own repository. See [the provider guide](../../docs/PROVIDER.md). This example supplies app-specific Playwright tests, not a general external-app runner or a workbench connection wizard.

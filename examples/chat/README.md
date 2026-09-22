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

## Run from the workbench

Start `npm run dev` (workbench and provider) and `npm run dev:example` in separate terminals. In the workbench on port 4317:

1. Select **Standalone chat** under **Test target**.
2. Wait for **Connected**. The chat appears in an iframe as a fresh instance; an already-open chat tab is independent.
3. Edit prompt, provider event timing/text, cancellation time, observation window, and forbidden text.
4. Choose Buggy or Fixed, then click **Run scenario**.
5. Watch the real controls and response in the embedded chat. Observed events and the app log return live while the playhead advances. The final verdict returns after observation finishes.

The bridge supplies an immutable scenario snapshot to the provider call and clicks the app's real Send and Cancel controls. App request handling and rendering stay real. Reset aborts the embedded app's pending transport and discards old replies. Outside workbench mode, the app continues using its original preset.

`workbench-bridge.ts` is an opt-in, example-specific adapter enabled only with `?timeline` when embedded. It accepts messages only from its parent at loopback workbench origins on ports 4317 or 4417. The workbench validates the reply's source, origin, and run ID. This is not an arbitrary-host runner; another app needs its own adapter and must permit framing.

Cancel and observation timers begin when the adapter observes the provider-connected log entry. Observations use browser request-submission-relative timestamps. The adapter reads the example's log to check all provider events arrived and the stream ended, and uses a MutationObserver on the actual rendered response for the assertion. No provider cancellation acknowledgement is inferred. Timing remains subject to browser scheduling; highlighted event attribution is diagnostic, not proof of cause.

If the app is absent, the workbench explains how to start it. Missing provider activity, unavailable cancellation, or an incomplete stream produces RUN ERROR. The workbench target defaults to port 4319; set `TIMELINE_EXAMPLE_PORT` on the backend for another loopback example port.

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

Keep your app's real rendering and state handling, adapt the client calls and development proxy to your environment, and retain app-specific configuration in your own repository. See [the provider guide](../../docs/PROVIDER.md). This example supplies app-specific Playwright tests, not a general external-app runner or a connection wizard for arbitrary apps.

## Retry after a connection failure

A transport error enables the real Retry button. Fixed mode replaces the abandoned partial response; Buggy mode deliberately retains it to demonstrate duplicated output. Use the [connected recovery configuration](../../docs/RUNNER.md#connection-loss-and-recovery-against-a-connected-app) to inject a first-request disconnect and verify recovery. The Vite development proxy propagates upstream abortion to the browser instead of leaving Fetch pending.

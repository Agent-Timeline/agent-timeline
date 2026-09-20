# Connected app runner

The CLI and workbench call the same Playwright runner. Your development app runs at its own URL; no iframe is required. Start the app separately and route its development stream endpoint to the local proxy. Keep production routing unchanged.

## Try the synthetic example

Install dependencies and Chromium once:

```sh
npm install
npx playwright install chromium
```

Start the example app in one terminal:

```sh
TIMELINE_PROVIDER_PORT=4468 npm run dev:example -- --port 4469
```

Run the configured test from the repository root in another:

```sh
npm run run:app -- --config examples/proxy/host.config.json --report /tmp/agent-timeline-report.json
```

The runner starts and stops the proxy itself. Do not start another proxy on port 4468. Exit codes: 0 passed, 1 assertion failed, 2 incomplete/error/stopped. The JSON report includes observed events and individual assertion results.

For the workbench, start:

```sh
TIMELINE_RUNNER_CONFIG=examples/proxy/host.config.json npm run dev
```

Open http://127.0.0.1:4317, select **Connected app (config file)**, and click **Run scenario**. Stop test returns an incomplete result; Replay again creates a fresh browser context. Each run reloads the configured file. The connected mode displays configuration and observed results; its actions are currently edited in JSON, not by dragging the built-in demo timeline. Only the latest run is retained in memory.

## Configure your app

Copy [host.config.json](../examples/proxy/host.config.json) into your own repository and change:

| Field | Meaning |
| --- | --- |
| `appUrl` | Local app URL; only its origin is allowed in the test browser. |
| `proxy.port`, `proxy.path` | Loopback proxy listener and POST stream route. Your app's development server must route the relevant endpoint here. |
| `proxy.scenario` | Version-1 scripted NDJSON responses. Requires a compatible client. |
| `proxy.upstream` | Alternative fixed local upstream URL. Forwards streamed bytes; does not convert provider formats or forward credentials. Use exactly one of scenario/upstream. |
| `proxy.delayMs` | Delay before response headers, not per-token jitter. |
| `proxy.disconnectMs` | Force response closure after elapsed time from request receipt. |
| `proxy.expectedRequests` | Required proxy request count, default 1. |
| `proxy.expectedOutcome` | Required completion or abortion for every request; default `complete`, alternative `aborted`. |
| `setup` | `click`, `fill`, or `select` actions before recording; use `atMs: 0`. |
| `actions` | Same actions scheduled in milliseconds from run start, after setup. `fill` and `select` require `value`. |
| `observeUntilMs` | Full observation window, at most 60 seconds. |
| `assertions` | `textAbsent` throughout the window starting at `fromMs`, or `textContains` at the end. |
| `evidence` | Required final text in an app diagnostic element proving the intended delivery path occurred. |

Selectors must be CSS and match exactly one element. Assertion and evidence targets must exist before the run. Missing selectors, missing delivery evidence, unexpected proxy outcomes, or blocked external requests produce **ERROR**, never a successful absence check. Evidence is an explicit host integration contract: a proxy write alone cannot prove that the browser received or rendered a response.

Example assertion:

```json
{"type":"textAbsent","selector":"#response","text":"stale result","fromMs":700}
```

A DOM mutation observer and periodic checks retain violations, including text that later disappears. Checks inspect DOM text content, not pixels or CSS visibility. They do not validate model quality or remote side effects. Action times are scheduled targets; real browser and transport timing can vary. `fromMs` is relative to run start, not an acknowledgement of the preceding action. Reports distinguish action completion and proxy delivery times.

This initial runner opens a fresh Chromium context without existing login sessions, blocks service workers and requests outside the app origin, and does not start your app or reset persisted application state. Use a disposable local fixture and explicit setup. Keep private selectors, fixtures, configuration, and reports in the consuming repository. No traffic or reports are uploaded by this runner.

One run is allowed per workbench backend. CLI processes require distinct proxy ports when used concurrently. Publication to npm, arbitrary authentication/setup hooks, recording, and general protocol adapters are not implemented.

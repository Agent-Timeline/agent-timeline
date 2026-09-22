# Connected app runner

The CLI and workbench call the same Playwright runner. Your development app runs at its own URL; no iframe is required. Start the app separately and route its development stream endpoint to the local proxy. Keep production routing unchanged.

## Generate a starter for your app

From the Agent Timeline checkout, run:

```sh
npm run init -- --app-url http://127.0.0.1:3000
```

This creates `agent-timeline.config.json`, checks the app's HTTP response, and starts a temporary proxy to check its health and port availability. The temporary proxy is stopped afterwards. It does not click app controls or send model/upstream requests. Redirects are reported instead of followed. These are reachability checks, not proof that your app routes streams through the proxy.

Existing files are never overwritten. The default config filename is gitignored in this checkout; custom filenames are not automatically ignored. Use `--out /path/to/your/private/repo/test-config.json` to keep host details with your app. The destination directory must already exist.

Specify existing CSS selectors to reduce manual editing:

```sh
npm run init -- --app-url http://127.0.0.1:3000 --send-selector '#send' --cancel-selector '#cancel' --response-selector '#response' --evidence-selector '#events'
```

Without those flags, the starter uses `data-testid` selectors for `send`, `cancel`, `response`, and `events`. These are suggested selectors, not auto-detected controls. Review the generated file before running:

1. Route the app's development stream endpoint to the generated proxy port/path. Simulation uses Agent Timeline NDJSON; it does not automatically adapt your SDK.
2. Match selectors to your real controls and containers. Add setup/fill actions for a prompt if needed.
3. Review cancellation and observation timing, forbidden response text, and delivery evidence. The initial example checks `Weekend Atlas` after 700 ms and observes until 2200 ms.
4. Replace `Stream ended` evidence with an app diagnostic that proves the intended delivery occurred. For aborting transports, review `expectedOutcome` and evidence accordingly.
5. Run the printed CLI command, or start the workbench with the printed `TIMELINE_RUNNER_CONFIG` command.

Use `--proxy-port` and `--endpoint` to choose the proxy listener, `--upstream` for a fixed local unauthenticated upstream instead of simulation, and `--evidence-text` to customize the diagnostic. `--skip-check` creates the config without network checks when the app is not running. `npm run init -- --help` lists all options.

Init exits 0 when generation and checks succeed (or checks were explicitly skipped), 1 when the config was saved but a reachability check failed, and 2 for invalid input or a write error. A generated config is not a passing test. If checks fail, fix startup/routing or edit the saved config; rerunning init will not overwrite it.

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
| `proxy.requests` | Optional ordered request plans with `expectedOutcome`, `delayMs`, and `disconnectMs`. Replaces global fault/outcome/count fields. |
| `proxy.expectedRequests` | Required proxy request count, default 1. |
| `proxy.expectedOutcome` | Required completion or abortion for every request; default `complete`, alternative `aborted`. |
| `setup` | `click`, `fill`, or `select` actions before recording; use `atMs: 0`. |
| `actions` | Same actions scheduled in milliseconds from run start, after setup. `fill` and `select` require `value`. |
| `observeUntilMs` | Full observation window, at most 60 seconds. |
| `assertions` | `textAbsent` throughout the window starting at `fromMs`, or `textContains` or `textEquals` at the end; optional `atMs` makes either a scheduled checkpoint. |
| `evidence` | Required final text in an app diagnostic element proving the intended delivery path occurred. |

Selectors must be CSS and match exactly one element. Assertion and evidence targets must exist before the run. Missing selectors, missing delivery evidence, unexpected proxy outcomes, or blocked external requests produce **ERROR**, never a successful absence check. Evidence is an explicit host integration contract: a proxy write alone cannot prove that the browser received or rendered a response.

Example assertion:

```json
{"type":"textAbsent","selector":"#response","text":"stale result","fromMs":700}
```

A DOM mutation observer and periodic checks retain violations, including text that later disappears. Checks inspect DOM text content, not pixels or CSS visibility. They do not validate model quality or remote side effects. Action times are scheduled targets; real browser and transport timing can vary. `fromMs` is relative to run start, not an acknowledgement of the preceding action. Reports distinguish action completion and proxy delivery times.

This initial runner opens a fresh Chromium context without existing login sessions, blocks service workers and requests outside the app origin, and does not start your app or reset persisted application state. Use a disposable local fixture and explicit setup. Keep private selectors, fixtures, configuration, and reports in the consuming repository. No traffic or reports are uploaded by this runner.

One run is allowed per workbench backend. CLI processes require distinct proxy ports when used concurrently. Publication to npm, arbitrary authentication/setup hooks, recording, and general protocol adapters are not implemented.

## Connection loss and recovery against a connected app

The [recovery configuration](../examples/proxy/recovery.config.json) uses the same independent chat, proxy, CLI, and workbench runner as the cancellation example. Start the example app with the commands above, then run:

```sh
npm run run:app -- --config examples/proxy/recovery.config.json
```

For the workbench, start its backend with this config (restart an existing backend to change it):

```sh
TIMELINE_RUNNER_CONFIG=examples/proxy/recovery.config.json npm run dev
```

Select **Connected app (config file)**. The separate built-in **Connection loss and recovery** editor still targets its demo; it is not this external-app run.

The config submits a request, cuts its stream after 400 ms, checks the connection-error status and partial text at 750 ms, clicks the real Retry button at 1000 ms, and checks the final response at 2700 ms. Fixed mode replaces partial output on retry. Buggy mode appends to it, so the exact-text assertion fails even though the status reaches Completed.

```json
"requests": [
  { "disconnectMs": 400, "expectedOutcome": "aborted" },
  { "expectedOutcome": "complete" }
]
```

Plans are assigned by arrival order of POSTs to the configured proxy path, starting from 1 per run. Both requests use the configured simulated scenario or upstream. Faults are relative to each request's receipt. Request 2 has no disconnect fault: recovery means a fresh request is allowed to finish, not that the first stream resumes. Additional requests are rejected and make the run incomplete. Background/automatic retries count too; use a dedicated test route and adjust plans/actions for your app. Do not combine request plans with global delay/disconnect or expected-count/outcome fields.

Observed events identify request numbers and distinguish fault injection, abortion, and completion. A planned disconnect must actually fire; merely seeing an aborted request cannot satisfy it. Missing retry/delivery produces ERROR, and assertion failures produce FAIL. Stop closes active connections and returns STOPPED; Replay creates a fresh proxy and request sequence.

Use `textContains` or `textEquals` with `atMs` for intermediate checkpoints. Checkpoint failures remain failures after later recovery. Without `atMs`, these inspect final text. `textAbsent` keeps its continuous `fromMs` behavior. Exact text compares whitespace too. Checkpoints use real scheduled browser time and do not freeze the app or retry until the assertion passes. Actions at the same scheduled time execute before checkpoints.

Your development reverse proxy must pass stream interruptions to the browser. The example's Vite proxy destroys the downstream response on upstream `aborted`; otherwise Fetch can remain pending and the test reports the disabled Retry control as an error. This is transport behavior, not a fake application error.

This tests abrupt stream loss and explicit full retry. It does not switch the browser offline, model a prolonged outage, resume a stream, verify backoff, or prove upstream side effects were cancelled. With a forwarding upstream, response content still depends on that upstream.

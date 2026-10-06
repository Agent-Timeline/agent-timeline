# Connected app runner

The CLI and workbench call the same Playwright runner. Your development app runs at its own URL; no iframe is required. Start the app separately and route its development stream endpoint to the local proxy. Keep production routing unchanged.

## Set up in the workbench

Start `npm run dev`, then select **Connect your app**. No `TIMELINE_RUNNER_CONFIG` is required for this flow.

1. Enter a loopback app URL, proxy port and POST endpoint path.
2. Enter CSS selectors for Send, Cancel, the response container, and delivery evidence. An optional prompt selector adds a fill action before Send.
3. Route your app's development requests to the displayed proxy address. Select Agent Timeline NDJSON or Chat Completions text SSE to match your app. The form does not modify app routing. See [Chat Completions setup](CHAT-COMPLETIONS.md).
4. Use **Check connection** for app reachability and temporary proxy startup. This does not verify selectors, routing, or stream compatibility.
5. Choose **Use this configuration**, review the editable timeline, and choose **Run scenario**. Read observed events and assertion results below it.
6. **Export runner config**, save the download locally, then run `npm run run:app -- --config agent-timeline.config.json` from the checkout for the same test.

The backend keeps the setup configuration in memory until restart. It replaces the current connected-app destination for that server session; it does not overwrite a config file. Reload configuration restores that session snapshot, or reads the environment-configured file when no setup session exists. Setup/check requests are rejected while a test or another setup check is active. Runs remain bound to the loaded destination, and each opens a fresh browser context without your existing login.

The starter checks cancellation at 700 ms, late text at a 1100 ms provider offset, and observes until 2200 ms. Delivery evidence must prove the response arrived, not just that a button was clicked. Use CLI/JSON configuration for forwarding a local upstream, custom protocols, or more complex request plans.

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

1. Route the app's development stream endpoint to the generated proxy port/path. Simulation defaults to Agent Timeline NDJSON; `--protocol chat-completions` selects text SSE. It does not automatically adapt other protocols.
2. Match selectors to your real controls and containers. Add setup/fill actions for a prompt if needed.
3. Review cancellation and observation timing, forbidden response text, and delivery evidence. The initial example checks `Weekend Atlas` after 700 ms and observes until 2200 ms.
4. Replace `Stream ended` evidence with an app diagnostic that proves the intended delivery occurred. For aborting transports, review `expectedOutcome` and evidence accordingly.
5. Run the printed CLI command, or start the workbench with the printed `TIMELINE_RUNNER_CONFIG` command.

Use `--proxy-port` and `--endpoint` to choose the proxy listener, `--upstream` for a fixed local unauthenticated upstream instead of simulation, and `--evidence-text` to customize the diagnostic. `--skip-check` creates the config without network checks when the app is not running. `npm run init -- --help` lists all options.

Init exits 0 when generation and checks succeed (or checks were explicitly skipped), 1 when the config was saved but a reachability check failed, and 2 for invalid input or a write error. A generated config is not a passing test. If checks fail, fix startup/routing or edit the saved config; rerunning init will not overwrite it.

## Try the synthetic example

Install dependencies and Chromium once:

```sh
npm ci
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

Open http://127.0.0.1:4317, select **Connected app (config file)**, and click **Run scenario**. Stop test returns an incomplete result; Replay again creates a fresh browser context. Run scenario executes the visible configuration snapshot. Replay again uses the previous report snapshot. Reload file explicitly discards edits and reads the configured file. Connected mode includes an editable timing timeline and a full JSON editor. Only the latest run is retained in memory.

## See a failure, then verify the fix

Use only the synthetic example above for this walkthrough. In `examples/proxy/host.config.json`, change the first `setup` action's `value` from `fixed` to `buggy`. This selects the example app's deliberately unsafe behavior; the workbench does not have a separate behavior switch for connected runs.

1. In **Connected app (config file)**, click **Run scenario**. Expect **FAIL** and a **Why this failed** section with the captured late response.
2. Run the same CLI command above. Expect exit code **1**, report kind `fail`, and assertion evidence. This is the intended demonstration, not a setup error.
3. Change that setup value back to `fixed`.
4. Click **Reload file**, then **Run scenario**, and rerun the CLI. Both should pass; the CLI exits **0**. Replay again deliberately preserves the previous run configuration.

Keep the example terminal running throughout. Install Chromium before connected runs, even when starting them from the workbench. If the workbench is already running without `TIMELINE_RUNNER_CONFIG`, stop that command and restart it with the configuration shown above. Do not start a second workbench or proxy on the same ports. **ERROR** indicates incomplete setup or delivery, and is distinct from the intentional **FAIL**.

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
| `proxy.requests` | Optional ordered request plans with `expectedOutcome`, `delayMs`, `disconnectMs`, and an optional simulated `scenario`. Replaces global fault/outcome/count fields. |
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

Plans are assigned by arrival order of POSTs to the configured proxy path, starting from 1 per run. Each request uses its own optional simulated `scenario`, otherwise the configured simulated scenario or upstream. Per-request scenarios require simulation mode. Faults are relative to each request's receipt. Request 2 has no disconnect fault: recovery means a fresh request is allowed to finish, not that the first stream resumes. Additional requests are rejected and make the run incomplete. Background/automatic retries count too; use a dedicated test route and adjust plans/actions for your app. Do not combine request plans with global delay/disconnect or expected-count/outcome fields.

Observed events identify request numbers and distinguish fault injection, abortion, and completion. A planned disconnect must actually fire; merely seeing an aborted request cannot satisfy it. Missing retry/delivery produces ERROR, and assertion failures produce FAIL. Stop closes active connections and returns STOPPED; Replay creates a fresh proxy and request sequence.

Use `textContains` or `textEquals` with `atMs` for intermediate checkpoints. Checkpoint failures remain failures after later recovery. Without `atMs`, these inspect final text. `textAbsent` keeps its continuous `fromMs` behavior. Exact text compares whitespace too. Checkpoints use real scheduled browser time and do not freeze the app or retry until the assertion passes. Actions at the same scheduled time execute before checkpoints.

Your development reverse proxy must pass stream interruptions to the browser. The example's Vite proxy destroys the downstream response on upstream `aborted`; otherwise Fetch can remain pending and the test reports the disabled Retry control as an error. This is transport behavior, not a fake application error.

This tests abrupt stream loss and explicit full retry. It does not switch the browser offline, model a prolonged outage, resume a stream, verify backoff, or prove upstream side effects were cancelled. With a forwarding upstream, response content still depends on that upstream.

## Editable connected sequence

The connected timeline is a projection of `RunnerConfig`, the same executable JSON accepted by the CLI; it is not another scenario format. Drag markers, use arrow keys or numeric fields to edit action times, assertion checkpoints/window starts, provider offsets and existing request faults. Final assertions remain pinned to the observation deadline. Full JSON editing covers text, selectors, setup, adding/removing events and faults. Invalid configurations cannot run or export. Edits remain in memory until exported.

Each lane labels its time origin: run start for actions, browser observation start for assertions, and request receipt for provider/fault offsets. The default provider template is reused unless a request plan supplies its own scenario; those templates appear in separate request lanes. Retiming a cancellation does not automatically change an assertion's observation start. No causal or clock alignment is inferred.

Run sends a bounded validated snapshot to the backend, which keeps the app URL, proxy route/port and upstream bound to the configured file. Change destinations in that file and reload. CLI and workbench reports include `scenario`, the configuration actually executed; replay uses it rather than a changed file. Export runner config produces a file accepted by `npm run run:app -- --config FILE`. Stop remains incomplete. Reports now include configuration as well as captured app text, so keep private reports in the consuming repository.

## Built-in demo adapters

Cancellation and recovery use this runner too. Their editors convert settings into a `RunnerConfig`; the report includes that executable snapshot. `capture` optionally maps up to ten names to CSS selectors whose text is recorded as `ui` events for workbench display. These observations do not replace assertions or delivery evidence. They can contain app text, so treat reports as application data. All gallery cases use this runner; the iframe example still uses its original runner.

## Customize a gallery preset

Select one of the seven gallery presets in the main workbench. Drag timing markers or edit their millisecond fields. Use **Scenario JSON → Edit full configuration → Load current JSON** to change response text, actions or assertions, then **Apply JSON**. Keep delivery evidence consistent if changing event types or counts. Use **Preset behavior** to compare Fixed and Buggy.

**Export runner config** saves the same snapshot consumed by the CLI; **Import runner config** validates a file up to 1 MB and preserves the current scenario on invalid input. **Reset preset** restores defaults. Preset app/proxy destinations are fixed; a configuration for your own application belongs in Connected app mode. Run executes the visible snapshot, Stop remains incomplete, and Replay uses the last report snapshot. Both local servers must remain running when using an exported demo configuration from the CLI.

## Diagnose a failed setup or run

An incomplete run reports `kind: "error"` and a structured `diagnosis` in the CLI JSON. The connected workbench shows the same diagnosis and a **Try this** instruction. This is separate from `kind: "fail"`, which means a configured UI assertion failed after required delivery checks completed.

| Diagnostic code | What was observed | What to check |
| --- | --- | --- |
| `proxy-unavailable` | Local proxy startup failed | Port availability and development routing |
| `browser-unavailable` | Browser startup failed | Install Playwright Chromium; review the launch error |
| `app-unreachable` | Navigation failed | Local app startup, URL and fresh-session access |
| `action-target` | A browser action failed | Selector validity, unique match, visibility, enabled state and control type |
| `selector-target` | A check could not resolve one target | Response/evidence selector and container lifetime |
| `origin-blocked` | A resource request left the configured app origin | Same-origin API routing, external resources or login redirects |
| `request-rejected` | Simulation rejected the request body | Protocol selection and payload shape |
| `no-proxy-request` | No matching POST reached the proxy during observation | Send behavior, endpoint, port and observation window |
| `upstream-error` / `stream-error` | Forwarding or stream delivery failed | Upstream availability and transport handling |
| `missing-evidence` | Required app delivery-log text was absent | Log selector/text, client parsing and whether delivery finished |
| `unexpected-outcome` | Request counts or completion/abort outcomes differed | Request plan, fault settings and observation duration |
| `observation-error` | Observation could not finish | Raw error, timing budget and app navigation |

Diagnostics report observed failure categories, not proven root causes. For example, missing delivery evidence can indicate a parser problem, but does not establish one. An action that fails first can prevent later routing checks from running. The original error remains available. User-stopped runs remain stopped/incomplete and do not receive a setup-failure diagnosis. Reports can contain app selectors and captured text; review them before sharing.

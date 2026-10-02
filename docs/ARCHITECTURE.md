# Architecture specification

## Current implementation

Cancellation and connection recovery convert their editable settings into the shared `RunnerConfig` contract. The backend Playwright runner drives isolated instances of the existing demo UIs with real Send, Cancel, Disconnect, Restore and Retry controls. The local proxy provides scripted streams; captured DOM observations and the runner's verdict return to the visible workbench. The CLI can execute the same report snapshot. All gallery presets also use the shared runner; the optional standalone-chat iframe retains its legacy runner.

`shared/demo-config.ts` supplies the built-in adapters, with canonical gallery recipes in `shared/race-scenarios.ts`. All gallery actions, final checks, forbidden-content windows and intermediate checkpoints are converted to RunnerConfig. Empty-string textEquals assertions support intentionally empty output; textAbsent and textContains still require nonempty text. A stable content container remains present during navigation/deletion, so a missing response node cannot silently become a passing assertion. Per-arrival log evidence distinguishes duplicate deliveries even when their payloads match. Recovery uses distinct per-request stream templates and requires the first request to abort and the retry to complete. Assertions include both the intermediate disconnected state and final output. The workbench does not calculate a separate verdict for automatic demos or gallery presets. Manual demo Send/Cancel remains available outside an automatic run.

Provider offsets start at request receipt; browser actions start at runner observation start. Captured UI snapshots and assertion evidence use the browser observation clock. App arrival labels use the app's request-submission clock. Browser scheduling and network latency are real, not virtualized. A highlighted last arrival is diagnostic context rather than proven causality.

The backend defaults its built-in target URL to the frontend port one below the provider port, and its temporary proxy to the provider port plus 20. Override with `TIMELINE_FRONTEND_PORT` and `TIMELINE_DEMO_PROXY_PORT`. Both processes must be running and Chromium installed. Built-in runs use the same one-active-run guard as configured runs. The bridge `/api/runner/stream` forwards only to that fixed loopback proxy; it is not a general forwarding endpoint.

The configurable external-app runner is documented in [host configuration](RUNNER.md). The provider client uses custom NDJSON and is not a published npm package.

## Product direction

Reproduce an AI streaming race in a real development app, verify its fix, and keep the failure caught in CI. The connected-app mode runs a local app at its own URL without iframe embedding or changes to its layout. The iframe remains an optional example, not the target integration contract.

A package is a delivery mechanism, not the product boundary. A small host configuration should identify the app URL, supported stream endpoint/protocol, request matching, browser actions, assertions, and reset/setup hooks. A backend snippet alone cannot discover UI controls or determine whether a response appeared. The first target is frontend/full-stack engineers testing AI interfaces; backend instrumentation can later connect internal operations to visible behavior.

## Implemented process boundaries

```text
Browser workbench
       | UI assets / same-origin API
       v
frontend/ :4317 (Vite)
       | /api HTTP proxy
       v
backend/ :4318 (Node HTTP) <--- client/ in a separate app or Node process
       |
       v
shared/ scenario validation and replay
```

`backend/server.ts` uses Node modules, shared contracts, and the local proxy/Playwright runner; it does not import frontend code. It serves the provider API and returns JSON 404 for other paths. `frontend/vite.config.ts` serves the UI and proxies API traffic. `client/provider.ts` has no frontend dependency and uses a type-only shared import. The backend runs alone with `npm run dev:backend`; the frontend runs with `npm run dev:frontend`; `npm run dev` supervises both processes. Both bind to loopback. Root package dependencies remain shared. The frontend build is separate from the backend and requires API routing when hosted.

## Implemented standalone chat control

```text
Workbench :4317 -- scenario + mode + run ID --> Chat iframe :4319
               <-- verdict + observations ---        |
                                               Real Send/Cancel
                                                      |
                                               Client + dev proxy
                                                      |
                                               Provider :4318
```

The iframe adapter is enabled only for an embedded `?timeline` instance and checks the parent origin/source. The workbench checks reply origin/source and run ID for live progress and final results. Its playhead starts at observed provider connection and marker highlights reflect received events, not scheduled time alone. The adapter changes only the supplied provider scenario and drives real app controls; it observes the DOM and app event log. Standalone tabs are not remotely driven. Browser tests exercise this same connection. `GET /api/example-target` returns the loopback example URL configured by `TIMELINE_EXAMPLE_PORT` (default 4319).

## System overview

This diagram specifies the planned implementation. The workbench is a standalone local React + Vite application; it has no Storybook dependency.

```text
                       +---------------------------+
                       | Scenario files (JSON)     |
                       | Actions / events / faults |
                       | Assertions + host config  |
                       +-------------+-------------+
                                     |
                                     v
+-------------------+   +---------------------------+   +-------------------+
| Local workbench   |<->| Shared local runner       |<->| Headless CLI / CI |
| Edit / run / view |   | Scenario engine           |   | Report + exit code|
+-------------------+   | Validate / schedule / IDs |   +-------------------+
                       +-------------+-------------+
                                     |
                  +------------------+-------------------+
                  | Stream + fault schedule              | Browser actions
                  v                                      v
     +---------------------------+          +---------------------------+
     | Local stream proxy        |          | Playwright driver         |
     | Protocol adapter          |          | Submit / cancel / reload  |
     | Delay / stall / disconnect|          | Observe + assert          |
     +-------------+-------------+          +-------------+-------------+
                   ^                                      |
                   | Requests / streamed responses        | Controls
                   v                                      v
     +---------------------------+          +---------------------------+
     | App stream caller         |<-------->| Real app at its own URL   |
     | Browser OR app backend    |          | UI / state / business logic|
     +---------------------------+          +-------------+-------------+
                                                          |
                                            +-------------v-------------+
                                            | Real test persistence     |
                                            | Save / load               |
                                            +---------------------------+

     Local stream proxy selects one response source:
          +--> Simulated response source (scenario events)
          +<-> Configured upstream (forwarding mode)

     Proxy transport observations + Playwright assertion evidence
          --> Shared local runner --> Workbench / CLI report
```

The app explicitly routes the selected development stream through the proxy. The protocol adapter translates supported messages; the proxy applies delivery faults. Simulation needs no upstream. Forwarding relays to the configured upstream. The app stays at its own URL without iframe embedding. Transport observations and UI assertion evidence return separately to the shared runner.

## Planned runtime responsibilities

- **Workbench:** edits scenarios and displays the runner's event log and assertion results. The application under test runs at its own local URL in a browser managed by Playwright; iframe embedding is not required.
- **Local runner:** owns each replay session, reset hooks, provider service, browser driver, and results. Both the workbench and headless CLI use this runner.
- **Scenario engine:** validates the scenario and dispatches provider events and browser actions on the defined schedule.
- **Local stream proxy:** receives explicitly routed development requests, serves simulated streams or forwards to a configured upstream, applies the fault schedule, and reports transport observations to the runner. It does not drive UI actions or determine assertion verdicts.
- **Protocol adapter:** translates scenario events to the supported wire protocol and parses forwarded stream messages where message-level fault injection is needed. Arbitrary SDKs and protocols are not supported automatically.
- **Playwright driver:** performs real browser interactions and evaluates assertions. It returns results to the runner. Persistence is checked through real save/load flows and observable outcomes.
- **Application under test:** retains its UI, request handling, cancellation logic, backend, and test persistence. An app that calls its provider directly from the browser needs no additional application backend.

In simulation mode, only provider responses are simulated; no live model or provider credentials are required. Forwarding mode uses the explicitly configured upstream and its normal authentication requirements. Private application integrations remain in their own repositories.

## Planned integration boundary

The host application explicitly routes the selected stream endpoint through the local proxy in development. The interception boundary can be browser-to-app-backend or app-backend-to-provider; configuration must identify which one is being tested. Keep business logic, request identity, cancellation handling, storage, and UI components intact. Real external mutations should use developer-owned test environments.

A provider adapter maps scenario events to the protocol the application already consumes. Browser actions are executed separately from provider events; do not replace the application reducer with a mock.

## Planned timing and fault semantics

Keep browser actions and provider events separate, correlated by run and request IDs. Add a fault layer at an explicitly named stream boundary. The source-checkout proxy provides first-response delay and midstream disconnection; extend it with inter-message delay, seeded jitter, and stalls. Record the seed and resolved fault schedule with each run. Do not claim virtualized browser time or packet-level network emulation.

A latency control must say what it delays: request forwarding, response headers, stream-message delivery, or a supported cancellation acknowledgement. Preserve protocol framing and message order unless a scenario explicitly requests a supported semantic fault. Duplicate logical messages are distinct from TCP packet retransmissions. Backpressure, buffering, connection closure, and cleanup must be tested in the adapter.

Cancellation has separate meanings:

- **Application cancellation:** invalidate the request in app state while delivery may continue; assert late results are not applied.
- **Transport abort:** abort Fetch and its reader. A backend continuing work does not imply that the aborted browser Fetch keeps yielding chunks. Assert browser cleanup and any separately observable backend behavior.
- **Remote cancellation acknowledgement:** only model an acknowledgement when the protocol exposes it; record request and acknowledgement separately.

A 300 ms delay can expose stale arrivals on a still-open stream. It must not fabricate post-abort Fetch delivery. Scheduled emission, observed receipt, browser actions, and rendered-state observations require separate timestamps. Absolute timestamps from different processes must not be compared without a defined clock mapping.


Use a monotonic scenario clock, stable ordering for equal timestamps, and explicit request correlation. Define whether timings are relative to scenario start or request receipt. Each replay resets the demo and pending event queue. Provider scheduling alone does not control real browser or network scheduling.

## Planned assertions and results

Support positive checks and negative checks over an observation window. A single assertion immediately after cancellation will miss late arrivals. Persistence checks must exercise actual save/load paths. The runner must reject unknown actions, unsupported event types, missing adapters, and unbound requests.

Results must distinguish assertion failure from infrastructure error, incomplete observation, and user-stopped runs. Only a completed observation with all required evidence can pass. The CLI must return nonzero for failure/error/incomplete outcomes and emit a machine-readable report with the scenario, seed, observed trace, and assertion evidence. Workbench and CLI must invoke the same runner and assertion implementation; inspection must never change a recorded verdict.

## Planned runner and proxy boundary

```text
Workbench OR CLI
       |
       v
Shared local runner ----> Playwright ----> App at its own URL
       |                                      |
       | scenario + fault schedule            | explicitly routed requests
       v                                      v
Local stream proxy <-------------------- App stream caller
       |
       +--> Protocol adapter + simulated response source
       |                  OR
       +--> Configured upstream (forwarding mode)
       |
       +---- transport observations ----------> runner
Playwright ---- rendered-state assertions ----> runner report
```

The runner owns per-run isolation, request correlation, setup/reset, timeout budgets, and cleanup. It provides commands and results to the workbench; the browser workbench does not need direct access to the app DOM. Playwright operates real app controls. Private selectors and test configuration stay with the consuming app.

## Local stream proxy and npm integration

Ship the local stream proxy, supported protocol adapter, and shared runner through one installable npm package initially, with a programmatic API and CLI. Package naming and publication remain undecided. The proxy now has a source-checkout CLI and server factory; the shared configurable runner is also implemented. Installable npm distribution remains planned. Nothing is published to npm yet.

The proxy has two explicit modes:

- **Simulate:** match a request to a scenario and emit scripted responses through the supported protocol, without contacting an upstream.
- **Forward:** relay a request to an explicitly configured development upstream and apply supported delays, stalls, or disconnects to delivery. Forwarding alone does not record payloads or make the upstream deterministic.

Host configuration includes the app URL, matched route and protocol, proxy boundary, simulation scenario or upstream URL, fault schedule, browser actions, assertions, and setup/reset hooks. A backend consumer can change its development endpoint; a browser consumer can use its existing same-origin development routing. Neither requires an iframe or a UI layout change. Do not advertise automatic compatibility with Fetch, EventSource, WebSockets, or arbitrary provider SDKs.

The proxy must preserve streaming delivery, status and supported headers, framing, backpressure, request identity, and abort propagation. Keep buffering bounded. Log scheduled release and observed forwarding/closure separately; proxy forwarding is not proof of browser receipt or UI rendering. Cleanup closes both sides and cancels pending fault timers. Transport failures remain distinct from scripted application errors.

Bind locally, allowlist upstream destinations and intercepted routes, and avoid an unrestricted forwarding endpoint. Upstream credentials stay in the configured development environment and must not appear in exported traces or workbench messages. Recording is an explicit, separate capability with redaction. Keep application state, persistence, and cancellation code real at the chosen interception boundary.

The runner configures the proxy per run and combines its observations with Playwright assertions. The proxy does not replace the runner, and installing the package does not eliminate the need to configure app-specific actions and checks.

## Scenario model and interoperability

Move presets into a versioned format supporting actors, requests, browser actions, provider messages, fault schedules, and assertions. Migrate cancellation and recovery to that format and runner before adding more scenario-specific execution code. Preserve version-1 compatibility or provide explicit migration and validation errors.

The timeline should render this data: swimlanes group actors/requests/operations, spans show durations, markers show discrete events, and links show known causal relationships. Planned events and actual observations remain distinct. Tool calls and subagent handoffs require adapter or instrumentation evidence; network capture alone does not reveal them. Display reasoning status or provider-exposed summaries only, not unavailable hidden reasoning.

Interoperability is a design constraint, not the first release's main feature. Future OTLP JSON import can populate an observed trace, but it is not automatically an executable scenario. Replay additionally requires supported payloads, actions, request bindings, fault configuration, and assertions. Imports must report missing data. Capture/export should be local-first with endpoint allowlists and redaction; recordings must not silently include credentials or unrelated traffic.

## Implementation order and acceptance

1. Define the shared scenario/event contract and migrate cancellation and recovery onto one runner.
2. Drive one independent synthetic app at its own URL with Playwright, using the local stream proxy, a documented protocol adapter, and host configuration. No iframe or layout rewrite.
3. Implement explicit simulation and configured-upstream forwarding modes, with first-response delay and midstream disconnect controls, observed timing, and cleanup verification.
4. Expose that same runner through the workbench and a configurable CLI. Run the same saved scenario in both.
5. Ship the proxy, protocol adapter, and runner in one npm integration, then expand fault types and protocols based on real integrations. Recording, OTLP import, and broader multi-agent tracing follow this foundation.

Acceptance requires a known buggy app to fail and its corrected version to pass using the same scenario. A broken adapter or missing delivery must produce a run error, not a pass. Verify cancellation, reset, independent concurrent runs, and no remaining timers/connections after completion. Demonstrate the CLI in CI with a failing exit code for the regression. The workbench must show the same assertion evidence as the CLI.

## Integration ownership

Public examples use invented data. Private consumers implement their own actions, selectors, and configuration. No proprietary application source, credentials, traces, assets, or repository history belongs here.

## Implemented connected-app runner

```text
Workbench Run/Stop ---- HTTP runner API --+
                                         |
CLI -- JSON configuration ---------------+--> backend/runner.ts
                                              |
                                              +--> Playwright --> app at its own URL
                                              |                    | same-origin dev routing
                                              +--> local proxy <---+
                                              |       |
                                              |       +--> NDJSON simulation OR fixed upstream
                                              v
                                    observed events + assertions
                                      /                     \
                                workbench               CLI JSON / exit code
```

The runner validates local URLs, starts one configured proxy, creates a fresh browser context, applies setup actions, observes DOM text, runs timed actions, and checks delivery evidence and assertions. Stop closes browser and proxy and returns an incomplete result. Proxy observations are transport events, not proof of rendering. The workbench polls the same report used by the CLI. One connected run is allowed per backend; separate processes must use distinct proxy ports.

Current limits: CSS selectors, click/fill/select actions, timed text-absence checks, checkpoint/final text-contains and exact-text checks, and required final delivery evidence. The host app must already be running and route its test endpoint to the proxy. The browser permits only the configured app origin. Arbitrary authentication/reset hooks, saved sessions, protocol adapters beyond NDJSON simulation, and migration of the built-in demo runners remain future work.

## Local setup command

`npm run init -- --app-url URL` generates a validated starter host config using exclusive file creation. It checks local app HTTP reachability without following redirects and temporarily starts the configured proxy for a health check. It does not modify app code, discover selectors, invoke browser actions, or contact the upstream. Setup diagnostics remain separate from runner verdicts; a successful health check does not prove end-to-end routing. See [setup options](RUNNER.md#generate-a-starter-for-your-app).

## Connected recovery execution

Optional ordered request plans assign fault offsets and expected transport outcomes per matched POST. The proxy numbers arrivals, injects a disconnect only for the selected request, and rejects requests beyond the plan. The runner requires both injected-fault evidence and the expected outcome for each request. A later request can complete normally against the same scenario/upstream. Timed text checkpoints run alongside real browser actions; their failures remain in the final verdict. CLI and workbench use the same implementation. This is explicit retry after stream interruption, not browser-offline simulation or stream resumption.

## Shared connected scenario and editable runner snapshot

`RunnerConfig` is the executable contract for connected cancellation and recovery, CLI, CI and workbench. `shared/runner-timeline.ts` projects its actions, assertions, provider template and request faults into labeled clock lanes and applies validated timing edits. It introduces no second execution schema. The workbench submits the visible snapshot to the same backend runner, and reports retain that configuration for replay/export. Host destinations stay bound to the configured file; the API limits submitted JSON to 1 MB and allows one active run.

Built-in cancellation, recovery and all gallery presets now execute through the shared runner. The optional iframe example remains a separate compatibility path. Version-1 provider metadata is retained; the seven non-recovery gallery presets now use the shared timing editor and RunnerConfig import/export.

## Editable gallery presets

The main selector loads the seven non-recovery gallery examples through GET /api/runner/preset/:id. POST to that endpoint runs the edited RunnerConfig snapshot through the same runner. App URL, proxy port/path and upstream must match the server-generated preset, just as connected-app snapshots remain bound to their configured destination. Presets require no host config file. Unknown presets and invalid snapshots are rejected.

ConfiguredRunner supplies timing editing, JSON payload/assertion editing, file import/export, Run/Stop/Replay, reset and assertion evidence for both preset and connected modes. Fully overridden default provider templates are omitted from the timeline so every visible provider event controls an executed stream. Reset responses cannot overwrite a newer edit/import. Legacy cancellation/recovery editors retain their specialized controls.

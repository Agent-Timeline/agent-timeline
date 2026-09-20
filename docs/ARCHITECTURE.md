# Architecture specification

## Current implementation

The standalone workbench edits scenarios in memory and sends a validated snapshot with each provider request. A local Node server emits the scheduled stream. The browser drives the demo's cancel control and observes DOM mutations through the configured window. The Playwright suite separately exercises the same demo for headless verification. Both use the scenario schema and provider, but the standalone chat has an example-specific iframe adapter; a unified browser/headless runner and arbitrary host adapters remain planned.

The workbench reports the last delivered provider event when forbidden text is first observed. Batched DOM updates can combine events, so the highlight is diagnostic context rather than guaranteed causal attribution. Provider event times begin at request receipt; automatic browser actions begin at the start acknowledgement. Real browser scheduling and transport latency are not virtualized.

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

`backend/server.ts` imports only Node modules and shared code. It serves the provider API and returns JSON 404 for other paths. `frontend/vite.config.ts` serves the UI and proxies API traffic. `client/provider.ts` has no frontend dependency and uses a type-only shared import. The backend runs alone with `npm run dev:backend`; the frontend runs with `npm run dev:frontend`; `npm run dev` supervises both processes. Both bind to loopback. Root package dependencies remain shared. The frontend build is separate from the backend and requires API routing when hosted.

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
                     +------------------------+
                     | Scenario files (JSON)  |
                     | Events + assertions    |
                     +-----------+------------+
                                 |
                                 v
+----------------------+   +----------------------+   +---------------------+
| Local workbench      |-->| Local runner         |<--| Headless CLI / CI   |
| React + Vite         |   | TypeScript           |   | Same scenario files |
| Edit / play / reset  |<--| Event log + results  |-->| Report + exit code  |
+----------------------+   +----------+-----------+   +---------------------+
                                      |
                                      v
                           +----------------------+
                           | Scenario engine      |
                           | Validate + schedule  |
                           | Match request IDs    |
                           +----------+-----------+
                                      |
                   +------------------+------------------+
                   | Provider events                     | Browser actions
                   v                                     v
        +----------------------+             +--------------------------+
        | Provider adapter     |             | Playwright driver        |
        | Local HTTP / stream  |             | Submit / cancel / reload |
        | Chunks / errors /    |             | Observe + assert         |
        | delayed results     |             +------------+-------------+
        +----------+-----------+                          |
                   ^                                     | Operates browser
                   | Requests                            v
                   |                          +--------------------------+
                   |                          | Real application UI      |
                   |                          | Rendering + state       |
                   |                          +------------+-------------+
                   |                                       |
                   |                          +------------v-------------+
                   +--------------------------| App's provider caller    |
                   | Simulated responses      | Browser OR backend       |
                   +------------------------->| Real business logic      |
                                              +------------+-------------+
                                                           |
                                              +------------v-------------+
                                              | Real test persistence    |
                                              | Exercise save / load     |
                                              +--------------------------+
```

## Runtime responsibilities

- **Workbench:** edits scenarios and displays the runner's event log and assertion results. The application under test runs at its own local URL in a browser managed by Playwright; iframe embedding is not required.
- **Local runner:** owns each replay session, reset hooks, provider service, browser driver, and results. Both the workbench and headless CLI use this runner.
- **Scenario engine:** validates the scenario and dispatches provider events and browser actions on the defined schedule.
- **Provider adapter:** receives real application requests and emits simulated responses in a supported protocol. The host must explicitly configure its provider caller to use the local endpoint; arbitrary SDKs are not supported automatically.
- **Playwright driver:** performs real browser interactions and evaluates assertions. It returns results to the runner. Persistence is checked through real save/load flows and observable outcomes.
- **Application under test:** retains its UI, request handling, cancellation logic, backend, and test persistence. An app that calls its provider directly from the browser needs no additional application backend.

Only provider responses are simulated. No live model or provider credentials are required for supported scenarios. Private application integrations remain in their own repositories.

## Boundary

The host application is configured to call the simulated provider in development. Keep business logic, request identity, cancellation handling, storage, and UI components intact. Real external mutations should use developer-owned test environments.

A provider adapter maps scenario events to the protocol the application already consumes. Browser actions are executed separately from provider events; do not replace the application reducer with a mock.

## Timing

Use a monotonic scenario clock, stable ordering for equal timestamps, and explicit request correlation. Define whether timings are relative to scenario start or request receipt. Each replay resets the demo and pending event queue. Provider scheduling alone does not control real browser or network scheduling.

## Assertions

Support positive checks and negative checks over an observation window. A single assertion immediately after cancellation will miss late arrivals. Persistence checks must exercise actual save/load paths. The runner must reject unknown actions, unsupported event types, missing adapters, and unbound requests.

## Integration ownership

Public examples use invented data. Private consumers implement their own actions, selectors, and configuration. No proprietary application source, credentials, traces, assets, or repository history belongs here.

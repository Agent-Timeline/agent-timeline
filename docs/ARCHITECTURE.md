# Architecture specification

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

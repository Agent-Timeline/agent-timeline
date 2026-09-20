# Project progress

Last updated: September 19, 2026.

## Current milestone

The standalone local workbench can edit and replay a cancellation scenario against the built-in demo, detect a late-result defect, and verify the corrected behavior. A separate scenario gallery now covers seven additional races in a fictional draft editor. External application integration remains the next milestone.

## Completed

- [x] Independent repository, MIT license, and project specifications.
- [x] TypeScript scenario validation and timed provider-event delivery.
- [x] Local streaming provider with request IDs and per-run scenario snapshots.
- [x] React demo with buggy and fixed cancellation behavior.
- [x] Editable event times, text chunks, completion, and errors.
- [x] Add, remove, and sort provider events.
- [x] Configure cancellation time, observation window, and forbidden text.
- [x] Automatic replay using the demo's real cancel control.
- [x] Observe rendered response mutations and report pass, fail, or run error.
- [x] Highlight the last delivered event associated with the first observed violation.
- [x] Reset pending delivery, timers, and observers.
- [x] Import and export validated JSON scenarios.
- [x] Headless verification commands for the built-in demo.
- [x] Desktop visual review and mobile overflow check.

## Latest improvement: verification commands

- Added `npm run verify`, combining `verify:backend` and `verify:frontend` with failure propagation.
- Backend checks use their own TypeScript scope, engine/client unit tests, and direct API tests against a fresh backend on port 4428. They start no frontend and launch no browser.
- Frontend checks use their own TypeScript scope, build the UI, and run browser tests with fresh frontend/provider processes on ports 4417/4418. Existing development servers are never reused.
- Updated AGENTS.md to require combined verification for implementation, test, dependency, and build changes; documentation-only changes are exempt and skipped/failed checks must be reported.
- Verification: `npm run verify` passed: both type checks, frontend build, 7 unit tests, 2 backend API tests, and 16 frontend browser tests.

## Previous improvement: independent frontend and backend

- Moved UI into `frontend/`, HTTP provider into `backend/`, engine into `shared/`, and connection into `client/`; updated imports, tests, examples, and documentation.
- The backend no longer imports Vite or serves UI assets. It runs alone on loopback port 4318 and returns JSON 404 for non-API paths.
- Frontend Vite runs independently on port 4317 with an API proxy. `npm run dev` supervises both, while `dev:frontend` and `dev:backend` run each separately.
- Added `build:frontend`; one root dependency manifest remains intentional. Static build hosting requires API routing.
- Verification: TypeScript checks, all 7 unit tests and 18 browser tests passed. Combined startup/shutdown was verified to start and stop both listeners; the combined development command was then restarted.
- Verified frontend production build and provider-only operation before starting the frontend: the standalone client streamed the fixture and the provider returned 404 for `/`.

## Previous improvement: reusable provider connection

- Added `createTimelineProvider` in `client/provider.ts`, a framework-independent Fetch/async-iterator client for the existing NDJSON endpoint.
- The cancellation workbench now uses it. It preserves late events and duplicate IDs while validating stream shape, request identity, timing, and termination.
- Added abort and reader cleanup, protocol tests, concurrent-request and abort tests against the real HTTP server, and a standalone Node consumer in `examples/provider-connection/run.ts`.
- Added `docs/PROVIDER.md` with the wire contract, development backend/proxy setup, cancellation semantics, and source-level integration instructions.
- Verification: full existing check passed (7 unit tests and 16 browser tests); both newly added HTTP integration tests passed separately. Type checking passed after the additions, and the standalone consumer printed the scripted response.
- Limits: custom protocol, no published package, no provider-SDK compatibility or direct cross-origin browser setup. Host UI actions/assertions and a separate chat UI remain next steps. No private application was used.

## Scenario documentation

- Added `docs/SCENARIOS.md` covering the cancellation workbench and all seven gallery presets: problems, exact timing, expected behavior, implemented assertions, and limitations.
- Linked the reference from the README and documented contribution steps and unsupported extensions.
- Checked the descriptions against the fixture, gallery recipes, and assertion implementation; documentation-only work did not require a new test run.

## Previous improvement: seven runnable race scenarios

- Added a gallery for out-of-order requests, cancel/retry, partial stream failure, navigation, deletion, changed inputs, and duplicate delivery.
- Each recipe operates real fictional editor controls and state, using simulated provider streams; buggy mode fails and fixed mode passes.
- Assertions observe forbidden content across replay, final content, deletion, intermediate error recovery, and complete provider delivery.
- Added optional provider event IDs for duplicate detection. Gallery recipes are TypeScript definitions, separate from the editable single-request JSON format.
- Verification: `npm run check` passed (TypeScript, 3 engine tests, 16 browser tests). Seven browser tests each exercised both buggy and fixed behavior; reset cleanup is covered separately. Desktop appearance and mobile overflow were checked.
- Limits: gallery-only host, fixed recipe timings, no gallery import/export, no persistence, and navigation changes local views rather than reloading a page.

## Previous improvement: observed cancellation timeline

- Added an observed interaction timeline for automatic and manual runs: cancel requested, response received, and late response received.
- Late arrivals identify whether the app accepted or ignored the event; assertions remain the source of rendered-UI verification.
- Browser timestamps use request submission as their origin and retain separate scheduled provider offsets. No remote cancellation acknowledgement is fabricated.
- Reset and new runs clear the observed timeline.
- Verification: `npm run check` passed (TypeScript, 3 engine tests, 8 browser tests), including event ordering, accepted/ignored late arrivals, and reset cleanup. Manual cancellation was also checked in the browser.

## Verified milestones

| Commit | Delivered | Verification |
| --- | --- | --- |
| `d982605` | Streaming provider and cancellation demo | TypeScript checks, 3 engine tests, 3 browser tests; fixed verification passes and buggy verification fails as intended. |
| `8c03fd0` | Editable timeline and automatic replay | TypeScript checks, 3 engine tests, 8 browser tests; timing edits, failure highlighting, JSON round trips, invalid-input rejection, error delivery, and reset. |

These are recorded results for those milestones, not a claim that checks have run against every future change. Run `npm run check` to verify the current checkout.

## Next: external application integration

- [ ] Define a small host configuration: local app URL, provider connection, browser actions, assertion target, and reset procedure.
- [ ] Connect a separate fictional example app while keeping its rendering, request handling, and application state real.
- [ ] Reproduce a late-result failure in that app, then verify its fix.
- [ ] Share scenario execution and assertion logic between workbench and headless runs.
- [ ] Accept an exported scenario file and host configuration directly from the CLI.
- [ ] Document the integration and verify setup from a clean checkout.

Success means a developer can connect an app outside this workbench, reproduce a timing failure, and rerun the saved scenario headlessly without editing the test runner.

## Later candidates

These are not implemented or committed release promises.

- Additional assertions for status, element visibility, and persisted state.
- Editable multi-request scenarios and portable host actions beyond the built-in gallery.
- Real save/load verification through a test application's persistence layer.
- Additional provider protocol adapters.
- Voice events and audio playback checks after text workflows are established.

## Current limits

- Automatic workbench and gallery replay control only their built-in demos.
- The CLI uses the default scenario fixture and demo-specific browser actions.
- The original workbench assertion checks text absence after cancellation; gallery assertions cover the additional cases above. A pass does not certify overall correctness.
- Event highlighting provides diagnostic context, not guaranteed root-cause attribution.
- Provider timing starts at request receipt; browser actions start at acknowledgement. Browser scheduling is not deterministic.
- Scenario edits are in memory until exported. The demo does not exercise persistence.
- Cancelling the demo ignores late results; it does not prove that a remote operation was cancelled.
- The tool runs locally without Storybook or live model calls.

## Updating this tracker

Update completed work, current limits, and next steps with each milestone. Record verification that actually ran. Keep private application details and data out of this document.

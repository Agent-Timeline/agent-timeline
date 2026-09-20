# Project progress

Last updated: September 19, 2026.

## Current milestone

The standalone local workbench can edit and replay a cancellation scenario against the built-in demo, detect a late-result defect, and verify the corrected behavior. A separate scenario gallery now covers seven additional races in a fictional draft editor. The workbench now drives the standalone chat through its example-specific adapter. General external-host configuration remains future work.

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

## Latest improvement: live replay feedback

- Added a moving playhead and elapsed-time readout anchored to observed provider connection for both built-in and standalone targets.
- Provider markers gain checkmarks only after receipt; cancellation is highlighted after the real action. Scheduled positions remain unchanged during replay.
- Standalone progress messages stream observations and app logs to the workbench during replay, retaining source/origin/run-ID checks.
- Reset clears animation, markers, and observations; final verdicts still wait for the observation window. Browser scheduling and message latency remain approximate.
- Added browser checks that live markers and observations appear before the verdict and remain cleared after reset for both targets.
- Verification: the first run caught a stylesheet editing error; corrected it and reran `npm run verify` successfully: 33 tests, type checks, and both builds. Live replay was also observed in the browser.

## Previous improvement: workbench drives standalone chat

- Added a target selector and embedded independent chat instance. Edited scenarios and behavior are sent as immutable run snapshots; verdicts, observed timings, and logs return to the workbench.
- The opt-in example adapter drives real Send/Cancel controls, observes rendered output, checks provider delivery, and handles reset and stale replies.
- Messages are restricted by source/origin; results are correlated by run ID. The backend advertises only a configured loopback example URL.
- Added integration coverage for edited prompt/timing/content, buggy/fixed verdicts, event highlighting, reset, and provider failure.
- Verification: `npm run verify` passed (7 unit tests, 2 provider API tests, 19 workbench/gallery/integration tests, 3 standalone tests; both type checks and builds). A visible browser run against the embedded chat returned PASS and the layout was reviewed.
- This is a specific example adapter, not universal host automation. It requires framing support and the example log contract. Browser and headless tests share this bridge; the old verification CLI remains demo-specific.

## Previous improvement: standalone chat integration example

- Added an independent plain-TypeScript chat app in `examples/chat`, using only the shared provider client and synthetic data. It imports no workbench UI or proprietary application code.
- The app has real Send/Cancel/Reset controls, request identity checks, scripted streaming responses, and fixed/buggy cancellation modes. Vite serves it separately on port 4319 and proxies to the provider on 4318.
- Added developer setup instructions and three browser tests: fixed cancellation, intentional buggy cancellation, and reset followed by a successful request.
- `npm run verify` passed: 7 unit tests, 2 API tests, 16 workbench/gallery tests, 3 example tests, type checks, and both frontend builds. The browser preview was visually reviewed.
- This milestone originally used a code-defined scenario; workbench control is now implemented above.
- Limits: source-level client import, one outstanding request, preset response content, no universal host configuration or workbench-driven external-app automation. Tests use actual browser controls and observe post-cancel DOM mutations.

## Previous improvement: verification commands

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

These are recorded results for those milestones, not a claim that checks have run against every future change. Run `npm run verify` to verify the current checkout.

## Current limits

- The workbench controls its built-in demo or the standalone chat example; gallery replay controls its built-in demos.
- The CLI uses the default scenario fixture and demo-specific browser actions.
- The original workbench assertion checks text absence after cancellation; gallery assertions cover the additional cases above. A pass does not certify overall correctness.
- Event highlighting provides diagnostic context, not guaranteed root-cause attribution.
- Provider timing starts at request receipt; browser actions start at acknowledgement. Browser scheduling is not deterministic.
- Scenario edits are in memory until exported. The demo does not exercise persistence.
- Cancelling the demo ignores late results; it does not prove that a remote operation was cancelled.
- The tool runs locally without Storybook or live model calls.

## Updating this tracker

Update completed work, current limits, and next steps with each milestone. Record verification that actually ran. Keep private application details and data out of this document.

## Public workbench theme toggle

Added a light/dark toggle to the workbench and gallery. Initial preference follows the system; explicit choice persists locally. Embedded standalone chat retains its own styling. Verification: npm run verify passed all 33 tests, type checks, and both builds. A local browser smoke check confirmed system light preference, toggling, persistence across reload, and the gallery toggle.

## Public timeline marker editing

Added pointer dragging for provider and cancellation markers with live millisecond labels and synchronized numeric fields. Arrow keys edit by 1 ms (Shift: 10 ms); Home/End move to bounds. Provider markers stay between neighboring events to preserve ordering; cancellation stays before observation end. Editing locks during a run. Verification: npm run verify passed 34 tests, type checks, and both builds, including a new drag/keyboard/bounds test.

## Stop and replay controls

Public workbench now supports Stop test and Replay again. Stop aborts the transport, removes pending timers/observers, invalidates the run, and marks it incomplete while preserving received workbench observations. The standalone target resets its embedded app to stop delivery. Cancel request remains a separate scenario action. Verification: npm run verify passed all 36 tests, type checks, and both builds. Stop/replay regressions cover both built-in and standalone targets, including waiting past the original observation deadline to reject stale verdicts.

## Stacked timeline labels

Public markers now have dedicated label rows, ordered by time, with right-extending labels and vertical connectors. Equal timestamps share a connector path. A fixed 290px viewport scrolls for larger sets; its height does not change during edits or runs. This first layout deliberately uses one row per event to avoid crossing connectors. Browser checks confirmed equal-time labels do not overlap and viewport height remains stable. Initial verification exposed a drag test using offscreen coordinates; after scrolling markers into view, npm run verify passed all 36 tests, type checks, and both builds.

## Time ruler and horizontal zoom

Added adaptive millisecond ticks, zoom from 1× to 16×, Fit timeline, and horizontal scrolling to inspect ranges. Zoom changes visual scale without changing scenario times. Label stacks still scroll vertically; this does not introduce event virtualization or clustering for thousand-event scenarios. Verification: npm run verify passed all 36 tests, type checks, and both builds. Browser smoke checks confirmed ticks, zoom scaling, unchanged event timing, and Fit timeline; the ruler was visually inspected.

## Connection recovery gallery scenario

Added simulated connection loss by aborting the active client stream, preserving partial content, restoring connection, and explicitly retrying. Checks intermediate disconnected state, duplicate/stale output, final Completed state, and expected delivery count. No browser-wide offline or stream-resume claim. Verification: initial full run had an existing out-of-order test time out while observing; an unchanged full rerun passed all 37 tests, type checks, and both builds. Recovery is covered by the gallery regression in buggy and fixed modes.

## Desktop timeline height

Expanded the public timeline viewport to follow desktop viewport height (180px allowance, 330–1000px bounds), with a smaller mobile height. Event count and dragging do not change the outer height. Verification: npm run verify passed all 37 tests, type checks, and both builds.

## Content-sized timeline viewport

Removed the forced desktop height: the box now sizes to its event-label content and only scrolls once it reaches the responsive maximum height. Small scenarios no longer leave a large empty area. Height remains stable when timing changes because row count stays constant. Verification: npm run verify passed all 37 tests, type checks, and both builds.

## Content-sized marker labels

Timeline label boxes now fit their label and millisecond text rather than reserving a fixed 132px width. Stacked rows and connector positions are unchanged. Verification: npm run verify passed all 37 tests, type checks, and both builds.

## Scenario play control

Added an accessible play button beside the scenario heading, wired to the same run/stop handlers as the main controls. During a run it stops the test; the stop icon appears on hover/focus and remains visible on touch devices. Invalid scenarios disable play. Verification: an initial run was disrupted by a hot reload during an accessibility-label edit; the settled-code rerun passed all 37 tests, type checks, and both builds. Browser smoke check confirmed play, hover-stop icon, and incomplete verdict.

## Received-event label emphasis

Observed markers now give their label boxes a darker surface in light mode and a lighter surface in dark mode. This uses the same received state as the checkmark; scheduled time alone does not trigger it. Verification: npm run verify passed all 37 tests, type checks, and both builds. Browser checks confirmed the background change in light and dark modes.

## Editable connection-recovery timeline

Added a gallery timeline with connection, request, and assertion lanes; editable timing fields drive the real gallery runner. Planned response positions are distinguished from observed arrivals. Validation blocks invalid ordering; editing resets prior results. This is a recovery-specific editor, not a portable multi-request JSON format or standalone-host integration. Verification: npm run verify passed all 38 tests, type checks, and both builds on an unchanged rerun. The first run hit incomplete-provider timeouts in two existing gallery cases. The recovery regression verifies editable timing, a passing run, invalid-order blocking, and restoring defaults; the timeline was visually inspected.

## Public update — September 20, 2026

Completed time ruler and 1×–16× zoom, content-sized timeline viewport and label boxes, a scenario play/stop control, and received-event emphasis in light and dark modes. Added connection-loss recovery coverage and its editable timeline, including timing validation and regression coverage. Updated README and scenario documentation.

Validation: the latest full `npm run verify` passed 38 tests, backend/frontend type checks, and both production builds. An earlier run encountered incomplete-provider timeouts in two existing gallery tests; the unchanged rerun passed. No runtime changes followed that verification.

## Interactive timeline demo video

Added the supplied `agenttimeline2.mov` recording under `docs/videos/` and linked it near the top of the README. Verified the relative link and copied file. Documentation/media only; no runtime code changed.

## Compact recovery lanes

Recovery timeline lanes now size to their event-row counts instead of all reserving 195px. The single-event lane uses 82px, removing unused space while preserving label separation. Browser layout inspection confirmed all event labels fit; `npm run verify` passed all 38 tests, type checks, and both builds.

## Workbench scenario selector

Added a workbench selector for cancellation and connection recovery. Recovery reuses the gallery runner with editable lanes and Run, Stop test, and Replay again controls. Switching unmounts the old runner, aborts its transport, and clears edits/results. Recovery remains limited to the fictional editor without JSON or external-host support. README documents those limits. `npm run verify` passed all 38 tests, type checks, and both builds; a browser smoke check also passed selection, recovery stop/replay, and switching away during an active run.

## Recovery playhead contrast

Changed the recovery playhead to a solid 2px line using the primary text color token for stronger light/dark contrast. Browser checks confirmed both theme colors and solid styling. `npm run verify` passed all 38 tests, type checks, and both builds.

## Recovery replay inspection

Added post-run inspection for recovery: recorded rendered text/status and timestamp-filtered events, a time slider, and pointer/keyboard dragging on the solid playheads. Live runs remain automatic; inspection preserves the final app state and verdict. Reset, timing edits, mode changes, and new runs clear recordings. This is in-memory text/status capture, not screenshot replay or arbitrary app capture. The new regression covers recorded disconnected state, pointer/keyboard seeking, unchanged verdict/output, and reset.

Verification: corrected an initial JSX syntax error; the final `npm run verify` passed all 39 tests, type checks, and both builds.

## Live recovery gradient

Added a trailing gradient synchronized to the recovery playhead during live runs: soft white in dark mode and gray in light mode. Labels stay above the trail, and reduced-motion preferences hide the decorative effect. Visually checked both themes. An accidental stylesheet write was repaired preserving the prior compact-lane and inspection styles; the final `npm run verify` passed all 39 tests, type checks, and both builds.

## Architecture direction: real-app fault testing

Updated the architecture to distinguish the current example adapters and separate runners from the planned iframe-free integration. Specified one shared workbench/CLI runner, host configuration, a supported stream adapter, explicit fault/cancellation semantics, outcome reporting, and implementation acceptance criteria. Interoperability and multi-agent visualization remain planned extensions. Documentation-only update; checked Markdown structure and diff formatting, with no additional runtime changes or test run.

## Architecture: local stream proxy

Made the local stream proxy an explicit planned runtime component, including simulation and configured-upstream forwarding, protocol adapters, fault injection, cancellation/backpressure handling, and one npm API/CLI integration with the runner. Updated the boundary diagram and implementation sequence. Documentation-only change; diff checks passed.

## System overview diagram alignment

Updated the planned system overview ASCII diagram to show the local stream proxy, protocol adapter, simulated/upstream response sources, and separate transport observations and UI assertion evidence. Names now match the detailed proxy architecture. Documentation only; diff formatting checked.

## CLI stream proxy and iframe-free regression example

Implemented `npm run proxy` with loopback binding, a fixed scenario or configured upstream, first-response delay, forced disconnect, request-size limits, response backpressure, abort propagation, and shutdown cleanup. Simulation uses the existing NDJSON protocol and overrides caller-provided scenarios. Forwarding passes streamed bytes to one configured unauthenticated development upstream; credentials are not forwarded. No publication, general runner, or workbench proxy controls are claimed.

Added a standalone Playwright example that clicks real Send/Cancel controls without an iframe, watches for transient forbidden text, and requires late-delivery and stream-end evidence. `npm run test:proxy` runs the corrected app; `TIMELINE_CHAT_MODE=buggy npm run test:proxy` intentionally fails. Added tests for forwarding, delay, disconnection, concurrent request identity, and upstream abort cleanup.

Validation: corrected an initial example selector mismatch. Final `npm run verify` passed 44 tests, type checks, and both builds. The separate buggy run failed with the expected late-chunk assertion and exit code 1. CLI help checked. Architecture, README, and example instructions updated.

## Configurable connected-app runner

Added a versioned local host configuration covering app URL, proxy port/route, simulated scenario or fixed upstream, response delay/disconnect, browser setup/actions, observation duration, text assertions, and required delivery evidence. The shared backend runner owns a fresh Playwright browser and local proxy, validates outcomes, and distinguishes pass/fail from errors and stopped observations.

`npm run run:app -- --config FILE` produces the same events and assertion report as the workbench's **Connected app (config file)** mode. Set `TIMELINE_RUNNER_CONFIG` on backend startup. Workbench Run, Stop test, and Replay again operate through the runner API without embedding the app. Added a synthetic example config and `docs/RUNNER.md` setup guide. No package is published and no traffic is uploaded.

Verification: fixed a browser function serialization issue found through the real CLI/API paths. Final `npm run verify` passed all 48 tests, both type checks, and both builds. New regressions cover CLI success, workbench success/stop, intentionally buggy UI failure, missing delivery evidence, missing selectors, and config validation. `git diff --check` passed.

Limits: app startup and development endpoint routing are explicit; CSS selectors and click/fill/select actions only; text-content assertions and host-provided delivery evidence; loopback URLs, same-origin browser requests, fresh sessions, and one run per backend. Connected actions are edited in JSON; built-in timeline runners are not migrated. Next: validate more independent integrations before adding protocol adapters or publishing the package.

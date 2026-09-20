# Project progress

Last updated: September 19, 2026.

## Current milestone

The standalone local workbench can edit and replay a cancellation scenario against the built-in demo, detect a late-result defect, and verify the corrected behavior. External application integration is the next milestone.

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
- Overlapping requests, retries, and navigation scenarios.
- Real save/load verification through a test application's persistence layer.
- Additional provider protocol adapters.
- Voice events and audio playback checks after text workflows are established.

## Current limits

- Automatic workbench replay controls only the built-in demo.
- The CLI uses the default scenario fixture and demo-specific browser actions.
- The supported assertion checks text absence after cancellation; a pass does not certify overall correctness.
- Event highlighting provides diagnostic context, not guaranteed root-cause attribution.
- Provider timing starts at request receipt; browser actions start at acknowledgement. Browser scheduling is not deterministic.
- Scenario edits are in memory until exported. The demo does not exercise persistence.
- Cancelling the demo ignores late results; it does not prove that a remote operation was cancelled.
- The tool runs locally without Storybook or live model calls.

## Updating this tracker

Update completed work, current limits, and next steps with each milestone. Record verification that actually ran. Keep private application details and data out of this document.

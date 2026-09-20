# Scenario reference

This document describes the implemented cancellation workbench and seven gallery presets. All examples use fictional content and real demo UI state with simulated provider responses.

## Running the scenarios

- Cancellation workbench: run `npm run dev`, then open `http://127.0.0.1:4317/`.
- Gallery: open `http://127.0.0.1:4317/?gallery`, select a case, and click **Run gallery scenario**.
- Choose **Buggy** to demonstrate a failure and **Fixed** to verify the correction.
- Run `npm run check` for type checks, engine tests, and browser tests. Gallery browser tests exercise every preset in both modes.
- `npm run verify:fixed` and `npm run verify:buggy` cover the original cancellation demo only. The buggy command intentionally exits with failure.

The cancellation fixture is [cancel-late-result.json](../scenarios/cancel-late-result.json). Gallery definitions are in [raceScenarios.ts](../frontend/raceScenarios.ts), with execution and assertions in [ScenarioGallery.tsx](../frontend/ScenarioGallery.tsx). Gallery presets cannot be imported into the workbench's version-1 JSON editor.

## Timing and verdicts

Gallery actions are scheduled from the start of replay. Provider event offsets are measured from receipt of **each individual request**, not from replay start. Approximate combined times below exclude transport and browser scheduling delays. Every gallery run observes for 1800 ms from replay start.

Gallery assertions inspect rendered output through a MutationObserver and at the final deadline. A recorded forbidden-text violation stays a failure even if the text is later removed. The final output must exactly match the preset's expected string; absent output is treated as an empty string. Deletion has an additional element-absence check. Only the partial-error case explicitly checks intermediate status.

A provider exception, a still-pending request, or a received event count different from the total scheduled count produces **RUN ERROR**, taking precedence over assertion failures. Otherwise a violated assertion produces **FAIL**; all configured checks holding produces **PASS**. These are bounded checks of the demo, not proof of general app correctness or pixel-by-pixel capture of every possible transient state.

The workbench uses a different clock for its cancel action and observation deadline: both start when the browser receives the provider's start acknowledgement. That is a stream-start acknowledgement, **not cancellation acknowledgement**. Its observed timeline timestamps start at browser request submission.

## 1. Cancel with a late result

ID: `cancel-late-result` — editable workbench.

**Problem:** A response arrives after cancellation and appears in the UI.

**Sequence:**

1. Submit the request.
2. Provider +100 ms: append `A possible title is `.
3. Browser +700 ms from stream-start acknowledgement: click Cancel.
4. Provider +1100 ms: deliver `Weekend Atlas`.
5. Provider +1300 ms: complete the stream.
6. Observe through +1800 ms from stream-start acknowledgement.

**Expected behavior:** The app ignores late events for the cancelled request. Already rendered partial text can remain.

**Assertions:** After the actual cancel action, `Weekend Atlas` must remain absent from the rendered response throughout observation. Its appearance records FAIL. Cancellation, a terminal event, and the full scheduled event count must be observed; missing activity produces RUN ERROR. A provider that does not start within 10 seconds also produces RUN ERROR.

**Limitations:** The assertion does not require an exact final response or status. Cancellation leaves transport open deliberately; no remote cancellation or acknowledgement is verified. Event highlighting identifies the last delivered event associated with a violation, not guaranteed root cause. Manual Send prompt/Cancel actions do not produce an automatic verdict.

## 2. Requests finish out of order

ID: `out-of-order` — gallery.

**Problem:** An older request finishes after the newest request and overwrites or contaminates its result.

**Sequence:**

1. Replay 0 ms: start request A; its text is scheduled at A +1000 ms, completion at A +1100 ms.
2. Replay 200 ms: start request B; its text is scheduled at B +200 ms, completion at B +300 ms.
3. B delivers `Newest result` around replay 400 ms and completes around 500 ms.
4. A delivers `OLD RESULT` around 1000 ms and completes around 1100 ms.

**Expected behavior:** Only B's result is applied; A remains stale even after B completes.

**Assertions:** `OLD RESULT` must never be observed in output. At 1800 ms, output must exactly equal `Newest result`. Shared provider-completion checks also apply.

**Limitations:** Two requests target one output. Independent destinations, larger concurrency, final status correctness, and real model execution are not checked.

## 3. Cancel then retry

ID: `cancel-retry` — gallery.

**Problem:** A cancelled request's late chunks mix into the replacement request.

**Sequence:**

1. Replay 0 ms: start A; text at A +1000 ms, completion at A +1100 ms.
2. Replay 200 ms: cancel A locally.
3. Replay 300 ms: start retry B; text at B +200 ms, completion at B +300 ms.
4. B delivers `Retry result` around 500 ms; A later delivers `CANCELLED RESULT` around 1000 ms.

**Expected behavior:** The retry owns the output; cancelled events are ignored.

**Assertions:** `CANCELLED RESULT` must never appear. Final output must exactly equal `Retry result`. Shared provider-completion checks apply to both requests.

**Limitations:** No remote cancellation acknowledgement, retry backoff, repeated retry chain, or server-side side-effect deduplication is tested.

## 4. Stream fails halfway through

ID: `partial-error` — gallery.

**Problem:** A stream error loses partial content or leaves the UI in a streaming state, even when a later retry succeeds.

**Sequence:**

1. Replay 0 ms: start A.
2. A +100 ms: deliver `Partial draft`.
3. A +250 ms: emit the terminal error `Connection lost`.
4. Replay 700 ms: inspect partial text and error status.
5. Replay 900 ms: start retry B.
6. B +200 ms: deliver `Recovered draft`; B +300 ms: complete.

**Expected behavior:** Retain partial content and expose an error before retry. The retry replaces the partial draft and succeeds.

**Assertions:** At 700 ms, output must exactly equal `Partial draft` and status must exactly equal `Error: Connection lost`. A mismatch remains FAIL even if retry succeeds. Final output must exactly equal `Recovered draft`. Shared provider-completion checks apply; there is no forbidden-text list for this case.

**Limitations:** The provider emits an explicit error event; this is not an actual dropped socket. Retry is scheduled, not conditional on UI recovery. The final completion status and editing of partial content are not asserted. Buggy mode deliberately fails to update the error status.

## 5. Navigate away and return

ID: `navigation` — gallery.

**Problem:** A request started in a previous view applies stale content after returning.

**Sequence:**

1. Replay 0 ms: start A.
2. Replay 200 ms: leave the editor for the library view and clear the draft.
3. Replay 500 ms: return to the editor.
4. A +1000 ms: deliver `WRONG SCREEN RESULT`; A +1100 ms: complete.

**Expected behavior:** Leaving invalidates pending results, and returning does not reactivate them.

**Assertions:** `WRONG SCREEN RESULT` must never appear in observed output. Final output must be empty. Shared provider-completion checks apply.

**Limitations:** Navigation changes local React views; it does not reload the browser or use real routing, history, or persistence. This preset delivers after returning, not while away. It does not separately assert the final view, and absent output counts as empty.

## 6. Delete during generation

ID: `delete-item` — gallery.

**Problem:** A delayed result recreates an item the user deleted.

**Sequence:**

1. Replay 0 ms: start A for the existing draft item.
2. Replay 200 ms: delete the item and clear its text.
3. A +1000 ms: deliver `DELETED ITEM RESULT`; A +1100 ms: complete.

**Expected behavior:** The item stays deleted and its pending result is ignored.

**Assertions:** `DELETED ITEM RESULT` must never appear. Final output must be empty, and the output element itself must be absent at 1800 ms. Shared provider-completion checks apply.

**Limitations:** One in-memory item, with no database, undo, cascading deletion, or ID reuse. Element absence is explicitly checked at the final deadline, not continuously; transient recreation without the forbidden text is not covered.

## 7. Change inputs during generation

ID: `change-inputs` — gallery.

**Problem:** A result generated for an earlier input is applied after the user changes that input.

**Sequence:**

1. Replay 0 ms: start A using `Original brief`.
2. Replay 200 ms: change the input to `Updated brief` and clear the draft.
3. A +1000 ms: deliver `OLD INPUT RESULT`; A +1100 ms: complete.

**Expected behavior:** Changing input invalidates A, leaving the output empty until another generation is requested.

**Assertions:** `OLD INPUT RESULT` must never appear. Final output must be empty. Shared provider-completion checks apply.

**Limitations:** No new request is generated for the updated input. The assertion does not separately check the input label or status. It does not test debouncing, multiple input fields, or model interpretation of the changed input.

## 8. Duplicate delivery

ID: `duplicate` — gallery.

**Problem:** Repeated delivery of the same provider event duplicates rendered content.

**Sequence:**

1. Replay 0 ms: start A.
2. A +100 ms: deliver `One result` with event ID `chunk-1`.
3. A +400 ms: deliver the same text and event ID again.
4. A +600 ms: complete.

**Expected behavior:** Apply the first event and ignore the repeated ID within that request.

**Assertions:** `One resultOne result` must never appear. Final output must exactly equal `One result`. Both duplicate deliveries count toward the expected provider event total; shared completion checks apply.

**Limitations:** Deduplication is per request and uses explicit event IDs. It does not compare text alone or persist deduplication across reconnects. Different payloads sharing an ID, duplicate terminal events, and external side effects are not tested.

## Adding or changing a scenario

1. For a single-request cancellation case, edit or export a validated version-1 scenario through the workbench. Keep event offsets ordered and end with complete or error.
2. For a gallery case, add a unique entry to `raceScenarios` with requests, timed actions, an exact final expected string, forbidden strings, and an optional intermediate checkpoint. The gallery currently exposes only first and second request actions and uses a fixed 1800 ms observation deadline.
3. Ensure every request can finish within that deadline, allowing room for browser and transport delays. A provider offset is relative to that request, so include its action's start time when planning the run.
4. Add real demo behavior and assertions when needed. An action label alone does not create coverage. New action types require controls and handlers; special assertions require runner changes.
5. The gallery test loop automatically exercises each preset in Buggy and Fixed modes. Run `npm run check` and confirm it detects the intended defect, rather than a different failure. Add focused tests for new assertion or lifecycle behavior.
6. Update this document and [PROGRESS.md](../PROGRESS.md). Use synthetic content and keep proprietary code, assets, traces, and private data out of examples.

## Not implemented

External host adapters, gallery JSON import/export, an editable multi-request timeline, persistent save/load checks, real route reload scenarios, cancellation acknowledgements, and voice interactions remain outside current coverage. These are possible extensions, not implemented scenarios or release commitments.

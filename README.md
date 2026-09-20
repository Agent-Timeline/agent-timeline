# Agent Timeline

Reproduce the exact moment your AI interface breaks, then turn it into a regression test.

Agent Timeline is an open-source project for reproducing timing bugs in AI interfaces: streaming responses, cancellations, retries, and delayed results.

The local workbench includes an editable event timeline, a streaming provider, automatic cancellation replay, and pass/fail assertions against a real demo chat. External application adapters are not implemented yet.

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4317.

1. Choose **Buggy** or **Fixed** application behavior.
2. Edit event times, text chunks, completion or error events, and cancellation timing.
3. Set the observation window and the text that must stay absent after cancellation.
4. Click **Run scenario**. The workbench submits the request, clicks the real cancel control, and observes the rendered response.
5. Read the pass/fail verdict and event log. A failed run highlights the last delivered provider event associated with the first observed violation; this is an attribution aid, not proof of root cause.
6. Export JSON to save the scenario, or import a saved file to replay it.

Events must be ordered, finish with one completion or error event, and fit inside the observation window. Use **Sort events by time** after retiming. Invalid scenarios cannot run or export. Edits stay in memory until exported; refreshing reloads the default fixture. Reset stops outstanding timers, observers, and delivery while retaining the edited scenario.

**Send prompt** and **Cancel request** remain available for manual exploration. Only **Run scenario** generates a workbench verdict.

Cancellation deliberately leaves the stream open to model a result that arrives after the user cancels. Fixed mode rejects the stale request ID; buggy mode displays it. This demonstrates client-side result handling, not cancellation of a remote side effect.

## Verify the failure and fix

```bash
npx playwright install chromium
npm run check
npm run verify:fixed
npm run verify:buggy
```

`check` validates TypeScript, the engine, and browser behavior, including confirming that the buggy demo exposes the known defect. `verify:fixed` exits successfully. `verify:buggy` intentionally exits with failure because it enforces the same no-late-results invariant on the buggy app.

Both automatic workbench runs and browser tests observe response mutations across the observation window, rather than checking only the final screen. A provider failure to start or an incomplete delivery produces a run error instead of a passing verdict. PASS applies only to the configured text-absence assertion, not overall application correctness. Reset aborts pending delivery and starts a fresh run. The demo has no persistence layer yet.

## Current boundaries

Scenarios supply the prompt, provider events, cancellation delay, observation duration, and assertion. Workbench replay currently controls the built-in demo only. Browser actions in headless verification remain demo-specific, not a general action registry. The CLI reads the default scenario file; exported files can be imported in the workbench or used to replace that fixture. Tests wait for the provider-start acknowledgement before timing cancellation; browser timing is approximate, while provider offsets are measured from request receipt. The server binds to loopback and is development-only. No API keys or live models are needed.

## Design

Simulate AI provider responses while the application’s real rendering, state, and persistence run. Control event timing, replay failures, and verify expected behavior with assertions.

- [Implementation scope](docs/MVP.md)
- [Architecture specification](docs/ARCHITECTURE.md)

## Credits

A project by Visuail LLC. Engineering: Kate Steinmeyer.

## License

Licensed under the [MIT License](LICENSE).

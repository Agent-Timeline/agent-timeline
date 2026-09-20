# Agent Timeline

Reproduce the exact moment your AI interface breaks, then turn it into a regression test.

Agent Timeline is an open-source project for reproducing timing bugs in AI interfaces: streaming responses, cancellations, retries, and delayed results.

The first prototype is runnable: a local streaming provider, a demo chat with buggy and fixed cancellation handling, and browser assertions. The editable timeline and adapters for external applications are not implemented yet.

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4317. Choose a behavior, send the prompt, and cancel before the late chunk arrives at 1,100ms. The provider schedule is read-only in this release; edit `scenarios/cancel-late-result.json` and restart the server to change it.

Cancellation deliberately leaves the stream open to model a result that arrives after the user cancels. Fixed mode rejects the stale request ID; buggy mode displays it. This demonstrates client-side result handling, not cancellation of a remote side effect.

## Verify the failure and fix

```bash
npx playwright install chromium
npm run check
npm run verify:fixed
npm run verify:buggy
```

`check` validates TypeScript, the engine, and browser behavior, including confirming that the buggy demo exposes the known defect. `verify:fixed` exits successfully. `verify:buggy` intentionally exits with failure because it enforces the same no-late-results invariant on the buggy app.

The browser tests observe response mutations across the observation window, rather than checking only the final screen. Reset aborts pending delivery and starts a fresh run. The demo has no persistence layer yet.

## Current boundaries

The fixture supplies the prompt, provider events, cancellation delay, observation duration, and assertion. Browser actions are currently implemented in the demo-specific Playwright test, not a general action registry. Tests wait for the provider-start acknowledgement before timing cancellation; browser timing is approximate, while provider offsets are measured from request receipt. The server binds to loopback and is development-only. No API keys or live models are needed.

## Design

Simulate AI provider responses while the application’s real rendering, state, and persistence run. Control event timing, replay failures, and verify expected behavior with assertions.

- [Implementation scope](docs/MVP.md)
- [Architecture specification](docs/ARCHITECTURE.md)

## Credits

A project by Visuail LLC. Engineering: Kate Steinmeyer.

## License

Licensed under the [MIT License](LICENSE).

# CLI proxy and late-chunk regression

Run from the repository root after `npm install` and `npx playwright install chromium`.

```sh
npm run proxy -- --scenario scenarios/cancel-late-result.json --port 4321
```

In a second terminal, route the independent chat's development endpoint to the proxy:

```sh
TIMELINE_PROVIDER_PORT=4321 npm run dev:example
```

Open `http://127.0.0.1:4319`. The app runs at its own URL, without iframe embedding. Send and cancel; the CLI fixture supplies the stream. The fixture overrides the example's request-supplied scenario. This integration supports Agent Timeline NDJSON, not arbitrary AI SDK formats.

## Playwright example

[late-chunk.spec.ts](late-chunk.spec.ts) sends a request, waits for connection, clicks the real Cancel control, and watches the response DOM throughout delivery. It checks that the late chunk actually arrived and the stream ended before asserting that the forbidden text was never displayed. The example intentionally leaves transport open after cancellation to exercise stale-result handling.

```sh
npm run test:proxy
```

This starts isolated proxy and app servers on ports 4458/4459. To prove the test catches the bug, run:

```sh
TIMELINE_CHAT_MODE=buggy npm run test:proxy
```

The buggy run must fail with `A late chunk appeared after cancellation` and a nonzero exit code. A transport failure also fails the test because delivery evidence is required. This is an example-specific test. For the shared configurable workbench/CLI runner, see [Connected app runner](../../docs/RUNNER.md). For another app, configure its development endpoint, actions, selectors, and completion evidence. Do not replace the app's cancellation handler with a mock.

## Forwarding and faults

Forward to one fixed development upstream endpoint:

```sh
npm run proxy -- --upstream http://127.0.0.1:4318/api/generate --port 4321 --delay-ms 300
```

This requires the upstream server to be running. The proxy accepts `POST /api/generate`, forwards its body, and streams the upstream status/body back. It forwards content type and content encoding; it does not forward cookies, Authorization, or arbitrary headers, follow redirects, or translate protocols. Use an unauthenticated synthetic development upstream. Raw SSE/NDJSON bytes can pass through, but only the simulation mode has an NDJSON event adapter. This is not yet message-aware injection for arbitrary protocols.

- `--delay-ms`: delay response headers and initial delivery after fixture validation or receipt of upstream response headers. Subsequent upstream bytes retain normal ordering; bytes may coalesce while waiting. This is not per-token jitter or packet latency.
- `--disconnect-ms`: forcibly close the downstream connection at this offset from proxy request receipt, including any delay. It may fire before response headers. It is a transport failure, not a simulated terminal event.
- Both times must be whole milliseconds from 0 to 60,000. Each request has a 65-second ceiling. Request bodies are capped at 256 KiB; response streaming honors downstream backpressure. Aborting downstream aborts upstream work at the connection boundary.

Example forced disconnect:

```sh
npm run proxy -- --scenario scenarios/cancel-late-result.json --disconnect-ms 900
```

The CLI binds only to `127.0.0.1`, exposes `GET /health`, rejects unknown routes/options, and closes active connections on shutdown. No automatic recording, credentials, payload logging, or npm publication is included. Source-level command today: `npm run proxy`; an installable distribution remains planned. The [connected-app runner](../../docs/RUNNER.md) provides workbench control.

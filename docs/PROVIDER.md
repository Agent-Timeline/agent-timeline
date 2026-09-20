# Connecting to the simulated provider

The reusable TypeScript client is [client/provider.ts](../client/provider.ts). It works in modern browsers and Node.js using Fetch and async iteration, without React or a provider SDK. This is a source-level integration with Agent Timeline's custom NDJSON protocol, not an OpenAI-compatible endpoint or a published npm package.

## Try a separate consumer

Start only the provider with `npm run dev:backend` (port 4318); no frontend process is required. In another terminal at the repository root:

```sh
npx tsx examples/provider-connection/run.ts
```

This separate Node process connects over HTTP and prints the default fixture's response. It does not import the demo UI or run assertions. Source: [run.ts](../examples/provider-connection/run.ts).

## Connect your application

Use the client from a local Agent Timeline checkout in a TypeScript-capable development setup. Resolve the import to `client/provider.ts`; its only dependency on the engine is a type-only import. Keep your production provider path separate and select the simulated provider explicitly in development.

```ts
import { createTimelineProvider } from '/absolute/path/to/agent-timeline/client/provider';

const provider = createTimelineProvider({
  endpoint: 'http://127.0.0.1:4318/api/generate',
});
const controller = new AbortController();

for await (const event of provider.generate({
  requestId: crypto.randomUUID(),
  signal: controller.signal,
  // scenario: yourValidatedScenario,
})) {
  switch (event.type) {
    case 'start':
      // Mark the stream as connected. This is not cancellation acknowledgement.
      break;
    case 'text':
      // Apply through your real app's request-identity and state checks.
      // appendToResponse(event.text);
      break;
    case 'error':
      // Show your app's error state; this is a scripted terminal event.
      break;
    case 'complete':
      // Finish the active request.
      break;
  }
}
```

The client validates framing, request identity, event shape, ordering, and stream termination. It preserves duplicate IDs and late events so your application can exercise its own stale-result and deduplication logic. HTTP errors, malformed streams, and incomplete streams throw exceptions; handle those in your application's error path. Scripted `error` events are yielded normally.

A custom Fetch implementation can be passed as `fetch` in connection options, for host-specific transport or tests. There are no automatic retries or timeouts. Pass an AbortSignal to impose a timeout or stop a transport.

### Browser and backend connections

A Node development backend can call the full loopback URL directly. For a browser app on another port, configure its development server to proxy a same-origin route, such as `/timeline-provider`, to `http://127.0.0.1:4318/api/generate`. Preserve the POST body, status, NDJSON content type, streaming delivery, and disconnect cancellation. Set the browser client's endpoint to that same-origin route.

The provider does not enable cross-origin browser access. A direct browser fetch from a different origin is not the supported setup. Proxy configuration depends on the host's server; no framework-specific proxy or external UI configuration is supplied yet. The example above runs in a Node host or a same-origin/proxied browser setup after adjusting the endpoint.

## Wire protocol

`POST /api/generate` accepts JSON:

- `requestId`: required by HTTP; 1–80 ASCII letters, digits, or hyphens. The client generates a UUID when omitted.
- `scenario`: optional version-1 scenario. Omission uses the server's default cancellation fixture. A supplied scenario is validated for each request and does not change other requests.

Responses use `application/x-ndjson`, one JSON event per line:

```json
{"type":"start","requestId":"example-1"}
{"type":"text","requestId":"example-1","atMs":100,"text":"Hello","eventId":"chunk-1"}
{"type":"complete","requestId":"example-1","atMs":200}
```

A terminal error uses `type: "error"` and `message` instead of `text`. `eventId` is optional. Event offsets begin when the provider starts replaying the request. The start event has no `atMs`. The endpoint accepts at most 256 KB of request JSON; the client limits individual decoded event lines to 262144 characters.

The scenario still includes cancellation and assertion metadata required by the version-1 schema. The provider only replays `events`: it does not click Cancel or evaluate assertions. The host/workbench owns those actions. Gallery multi-request recipes are not accepted as HTTP scenarios; each individual request needs a version-1 scenario.

## Cancellation semantics

For an actual transport abort, call `controller.abort()` or exit the async iteration. The client aborts the fetch and releases its reader; the server stops delivery on disconnect. This does not represent a cancellation acknowledgement event.

For a late-arrival race test, invalidate the request in the application's state **without aborting transport**, then continue consuming events. Let the app decide whether to apply them. Passing cancellation directly to the transport removes the late arrivals you are trying to test.

## Boundaries

- Local development only; the server binds to loopback.
- No live model calls, API keys, prompt interpretation, production credentials, or automatic app discovery.
- Fixed scripted output is independent of the user's live prompt. Do not forward production request bodies or credentials; the endpoint only needs synthetic scenario data and a request ID.
- No provider-specific SDK compatibility, tool calls, audio, or cancellation acknowledgements.
- No external-app button selectors, automated UI actions, or assertions yet. The reusable provider connection is the first integration layer.
- App configuration and app-specific scenarios can remain in a separate private repository. Nothing in the connection requires publishing them.

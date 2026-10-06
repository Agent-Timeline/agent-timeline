# Chat Completions text streaming

The local proxy can simulate the text-only Chat Completions SSE format. Apps that already consume this format can keep their parser and point their development endpoint at the proxy. No live model, API key, or external service is used by the synthetic example.

This is a wire-format adapter, not a complete OpenAI API emulator. It does not implement Responses, tool calls, audio, multiple choices, usage accounting, or model inference. Model names are echoed as metadata; the scenario controls all output regardless of the prompt. Do not change production routing.

## Try the independent example

From this checkout, start the example in one terminal:

```sh
TIMELINE_PROVIDER_PORT=4468 npm run dev:example -- --port 4469
```

Then run the test in another:

```sh
npm run run:app -- --config examples/proxy/chat-completions.config.json
```

The runner starts and stops its proxy on 4468. The example page is `http://127.0.0.1:4469/sse.html`. It uses Fetch and a small SSE parser; it does not import the Agent Timeline client. Its Cancel button intentionally leaves the transport open, so the same late text reaches both buggy and fixed handling. Fixed handling discards it. This exercises stale-response handling, not remote cancellation acknowledgement.

For the workbench:

```sh
TIMELINE_RUNNER_CONFIG=examples/proxy/chat-completions.config.json npm run dev
```

Select **Connect your app** and use the loaded configuration below the setup form. Edit timing and choose **Run scenario**. Change the `#mode` setup action from `fixed` to `buggy` in Scenario JSON to reproduce the failure. The same JSON runs through the CLI. Export edited configurations before closing the workbench.

## Connect an existing app

In **Connect your app**, choose **Chat Completions SSE (text only)** as the stream protocol. Enter your local app URL and selectors. Set the proxy route to match your development integration, for example `/v1/chat/completions`. Your app or its development server must route requests to the displayed proxy address. No automatic routing changes or CORS bypass are performed.

For a server-side client that uses a Chat Completions base URL, point the development base URL at `http://127.0.0.1:4468/v1` and configure the proxy path `/v1/chat/completions`. Keep credentials out of browser code. The simulator does not authenticate requests and does not require real credentials; an SDK that requires a key locally can use a dummy development value. The runner's proxy exists only during a test.

Send a JSON POST with `model`, text `messages`, and `stream: true`. The simulator assigns its own completion ID; no Agent Timeline request ID or scenario payload is needed. Set `proxy.protocol` to `chat-completions` in RunnerConfig. Omit it for existing NDJSON consumers. A protocol setting is rejected with upstream forwarding, which preserves upstream bytes instead.

CLI setup:

```sh
npm run init -- --app-url http://127.0.0.1:3000 --protocol chat-completions --endpoint /v1/chat/completions
```

For manual testing without the runner:

```sh
npm run proxy -- --scenario scenarios/cancel-late-result.json --protocol chat-completions --path /v1/chat/completions --port 4468
```

Do not start the manual proxy while the runner owns the same port. `--delay-ms` delays the first response, and `--disconnect-ms` tears down the connection. The runner also supports these settings and per-request plans in JSON.

## Supported behavior and limits

- SSE `data:` frames carry `chat.completion.chunk` objects with a stable ID, timestamp, model, and one choice.
- An initial assistant-role delta precedes timed text deltas. Completion sends an empty delta with `finish_reason: "stop"`, then `[DONE]`.
- Scripted error events send an `error` envelope and end without a successful stop or `[DONE]`. This is the simulator's failure convention, not a reproduction of every provider error path.
- Forced disconnects terminate transport without fabricating completion. First-response delay, per-request timing and disconnect settings use the same proxy scheduler as NDJSON.
- Unsupported tool, audio, usage and multi-choice requests are rejected. Other generation settings do not change scripted content. Event IDs from scenarios are not emitted as Chat Completions deduplication IDs.
- Browser actions and provider events have different clock origins. Timing is approximate, and chunk boundaries can be coalesced by network buffering.
- Tests cover synthetic HTTP framing, escaping, delay, disconnect and error behavior, plus buggy/fixed UI handling via the shared runner, workbench and CLI. This is not a compatibility certification for every SDK or framework.

Wire-format reference: [OpenAI streaming documentation](https://developers.openai.com/api/docs/guides/streaming-responses).

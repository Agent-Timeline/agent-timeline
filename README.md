# Agent Timeline

Reproduce the exact moment your AI interface breaks, then turn it into a regression test.

Agent Timeline is an open-source project for reproducing timing bugs in AI interfaces: streaming responses, cancellations, retries, and delayed results.

Development has not started; this repository currently contains the project specifications.

## Design

Simulate AI provider responses while the application’s real rendering, state, and persistence run. Control event timing, replay failures, and verify expected behavior with assertions.

- [Implementation scope](docs/MVP.md)
- [Architecture specification](docs/ARCHITECTURE.md)

## License

Licensed under the [MIT License](LICENSE).

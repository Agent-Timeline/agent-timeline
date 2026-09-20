# MVP

## User

A frontend engineer reproducing a timing bug in an AI-powered web application.

## Acceptance demonstration

1. Run a fictional demo application with real request and cancellation logic.
2. Load a versioned scenario that schedules a delayed response.
3. Cancel the request before the response arrives.
4. Observe the incorrect UI in an intentionally buggy demo mode.
5. Enable the corrected implementation and replay.
6. Assert no cancelled response appears, including during the remaining observation window.
7. Run the same scenario headlessly and report a failing or passing exit code.

## First release

- Text chunks, completion, errors, delays, and cancellation races.
- Editable event timing, play, reset, and event log.
- Request identity and scenario validation.
- Browser actions and explicit assertions.
- JSON scenario files and a headless runner.

## Excluded initially

Voice and microphone simulation, automatic fixes, arbitrary application integration without setup, hosted accounts, production traffic capture, and a universal workflow builder.

## Validation

Measure time to reproduce a known timing bug versus a hand-written Playwright test and mocks. Ask external engineers to bring a failure and use the tool without guided setup. Broad demand is unproven.

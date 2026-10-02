# Contributing to Agent Timeline

Thanks for helping make AI interface timing bugs reproducible. Bug reports, documentation improvements, accessible UI fixes, and synthetic regression scenarios are welcome.

## Start small

For a small fix, open a pull request directly. Before starting a major feature, new dependency, or architecture change, open an issue describing the problem and proposed approach so we can agree on scope. If you are unsure where to start, describe a timing bug you have encountered using a fictional example.

This guide covers the public Agent Timeline repository and its fully functional default UI. The separate custom design system shown in some demos is not part of this repository or its contribution scope.

## Local setup

Use Node.js 22.12 or newer. Fork the repository, clone your fork, and create a branch for your change:

```bash
git clone https://github.com/YOUR-USERNAME/agent-timeline.git
cd agent-timeline
git switch -c fix/describe-your-change
npm ci
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:4317. The development command starts the frontend and provider locally. Synthetic examples need no API keys or live model account. See the [README](README.md) for independent startup commands and the [architecture](docs/ARCHITECTURE.md) for boundaries.

## Implementation and checks

- Keep changes focused. Preserve real application behavior while simulating provider responses.
- Keep React UI in `frontend/`, HTTP provider and runner code in `backend/`, contracts in `shared/`, and the reusable connection in `client/`. Do not introduce frontend dependencies into the backend.
- Add or update meaningful tests for behavioral changes. For a new race scenario, describe the event sequence, expected behavior, assertions, and limitations in [SCENARIOS.md](docs/SCENARIOS.md). Demonstrate the defect in buggy mode and the correction in fixed mode where applicable.
- UI changes should work in light and dark mode, at narrow widths, and with keyboard navigation. Preserve visible focus, accessible names, and alternatives to dragging.
- Update relevant documentation when behavior or configuration changes. Clearly distinguish implemented behavior from proposed capabilities.

Before submitting code, tests, dependency, or build changes, run from the repository root:

```bash
npm run verify
```

This runs backend and frontend checks, builds, and browser tests. You can use `npm run verify:backend` or `npm run verify:frontend` during development, but run the full check before submitting. Report failures or skipped checks in the PR. Existing CI runs selected stream regressions; it does not replace the full local check.

For documentation-only changes, review links and examples and run `git diff --check`; the full suite is not required. `npm run verify:buggy` intentionally fails to demonstrate the known defect and is not a readiness check.

## Safe, shareable examples

Use synthetic prompts, content, and application data. Do not commit credentials, tokens, private URLs, customer data, proprietary source, assets, traces, or repository history from other projects. Review screenshots, logs, recordings, and test reports before attaching them: they can capture application text. Reproduce private-app issues with a minimal fictional example instead.

Keep local integration configurations and reports out of commits. Ignore rules are a convenience, not a substitute for reviewing your diff. If you find a security issue involving sensitive data, do not post that data in a public issue or PR.

## Pull requests and review

Submit your branch as a pull request to `main`. Include:

- The problem and what changes for the user.
- A linked issue when relevant and reproduction steps for bug fixes.
- Checks run and their actual results, including anything not verified.
- Screenshots for visible UI changes, using synthetic content.

The maintainer reviews and decides what merges. Opening a PR does not grant write access. Keep discussions respectful and constructive, and explain tradeoffs when suggesting changes.

## License

By submitting a contribution, you agree to license that contribution under this repository's [MIT License](LICENSE). Only submit material you have the right to contribute. Third-party code must have a compatible license and retain required notices and attribution.

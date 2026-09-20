# Agent Timeline

Keep public examples synthetic. Do not copy proprietary source code, assets, traces, or repository history from other projects. Never include credentials or private user data. Any third-party open-source code must comply with its license and retain required attribution.

Read README.md and docs/MVP.md before implementation. Preserve real application behavior while simulating provider responses. Keep examples fictional. Clearly distinguish proposed features from implemented ones. Do not publish or choose a license holder without the owner's direction.

Build a standalone local React + Vite workbench. Do not add Storybook as a dependency or require it for host application integration.

Update PROGRESS.md with each implementation milestone, including completed work, actual verification results, current limits, and next steps.

Keep runtime boundaries explicit: frontend code lives in `frontend/`, the standalone HTTP provider in `backend/`, scenario contracts and replay in `shared/`, and the reusable connection in `client/`. The backend must not import Vite, React, or frontend code. Preserve independent frontend and backend startup commands.

Before declaring code, tests, dependencies, or build configuration ready, run `npm run verify` from the repository root. It runs `verify:backend` (backend/client type checks, unit tests, and direct provider API tests without a frontend) and `verify:frontend` (frontend type checks, build, and browser tests). Report failures or skipped checks explicitly. Documentation-only changes do not require these checks.

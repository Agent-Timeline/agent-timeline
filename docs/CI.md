# Run stream regression checks in GitHub Actions

The working example is [agent-timeline.yml](../.github/workflows/agent-timeline.yml). It runs cancellation and connection-recovery scenarios against the public synthetic chat on pull requests, pushes to main, and manual dispatch. Each matrix job installs Node 22 and Chromium, starts the chat, waits for readiness, invokes the shared CLI, and stops the app. No model keys or private application are used.

The runner owns the proxy. Do not start another proxy on its port. Exit 0 passes the job; assertion failure (1) or incomplete/error (2) fails it. The workflow does not suppress the runner's exit code. Even on failure, the final step attempts to save `reports/result.json` and `reports/app.log` as a seven-day artifact. Setup failures before the app starts may have no report. Download artifacts from the workflow run's summary.

## Adapt for your application

This tool currently runs from source, not a published npm package. In your app repository:

1. Check out your app and check out `Agent-Timeline/agent-timeline` into a separate tooling directory at a reviewed commit SHA. Install dependencies in each checkout.
2. Replace the example startup command with your app's development/test server command. Match the readiness URL to your local test app.
3. Keep your runner JSON in your app repository. Set its app URL, proxy endpoint, setup actions, selectors, assertions, and delivery evidence. Route only the app's development stream endpoint to that proxy.
4. Invoke `npm run run:app` from the tooling checkout with absolute paths to your config and report. Ensure the upload step points to that report location.
5. Start with a passing fixture, then deliberately reproduce the bug to confirm the check turns red and the evidence artifact is useful.

The checked-in workflow is runnable unchanged in this repository; adapting it to another app requires its startup command and integration configuration. For branch protection, explicitly require the corresponding Stream regression check in your repository rules. Adding a workflow alone does not prevent merges or deployments.

Reports include captured app text, selectors, and logs. Keep private-app workflows and artifacts in the private app repository and review what they collect before sharing. This public workflow uses synthetic data only. It uses read-only repository permissions and no `pull_request_target` execution.

Local equivalent: follow [the synthetic runner walkthrough](RUNNER.md#try-the-synthetic-example). Stop the app afterwards. GitHub's artifact upload is specific to Actions; a local run writes the JSON report directly.

References: [GitHub artifact action](https://github.com/actions/upload-artifact) and [Node setup action](https://github.com/actions/setup-node).

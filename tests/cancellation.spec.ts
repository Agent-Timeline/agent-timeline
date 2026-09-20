import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseScenario } from '../shared/engine';
const scenario = parseScenario(JSON.parse(readFileSync(new URL('../scenarios/cancel-late-result.json', import.meta.url), 'utf8')));
const verificationMode = process.env.AGENT_TIMELINE_VERIFY;
for (const mode of verificationMode ? [verificationMode] : ['buggy', 'fixed']) {
  test(`${mode}: same late-result scenario ${mode === 'buggy' ? 'detects the defect' : 'passes the invariant'}`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Application behavior').selectOption(mode);
    await expect(page.getByRole('button', { name: 'Send prompt' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send prompt' }).click();
    await expect(page.getByTestId('event-log')).toContainText('Provider connected');
    await page.waitForTimeout(scenario.cancelAtMs);
    await page.getByRole('button', { name: 'Cancel request' }).click();
    // Observe every DOM mutation through the entire window, not just the final state.
    await page.evaluate((needle) => {
      const node = document.querySelector('[data-testid="response"]')!;
      const state = window as unknown as { violations: string[]; observer: MutationObserver };
      state.violations = [];
      const inspect = () => { if (node.textContent?.includes(needle)) state.violations.push(node.textContent); };
      state.observer = new MutationObserver(inspect); state.observer.observe(node, { subtree: true, childList: true, characterData: true }); inspect();
    }, scenario.assertion.text);
    await page.waitForTimeout(scenario.observeUntilMs - scenario.cancelAtMs);
    await expect(page.getByTestId('event-log')).toContainText('1300ms · complete');
    const violations = await page.evaluate(() => { const state = window as unknown as { violations: string[]; observer: MutationObserver }; state.observer.disconnect(); return state.violations; });
    if (mode === 'buggy' && !verificationMode) expect(violations.length).toBeGreaterThan(0);
    else { expect(violations).toEqual([]); await expect(page.getByRole('status')).toHaveText('Cancelled'); }
  });
}
test('reset prevents previous request delivery from contaminating a new run', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Send prompt' }).click();
  await expect(page.getByTestId('response')).toContainText('A possible');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('response')).toBeEmpty();
  await expect(page.getByRole('status')).toHaveText('Idle');
  await page.getByRole('button', { name: 'Send prompt' }).click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  await expect(page.getByTestId('response')).toHaveText('A possible title is Weekend Atlas');
});

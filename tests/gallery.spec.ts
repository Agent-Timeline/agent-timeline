import { test, expect } from '@playwright/test';
import { raceScenarios } from '../frontend/raceScenarios';
for (const scenario of raceScenarios) {
  test(`${scenario.id}: detects buggy behavior and verifies the fix`, async ({ page }) => {
    await page.goto('/?gallery');
    await page.getByLabel('Gallery scenario').selectOption(scenario.id);
    await page.getByLabel('Gallery behavior').selectOption('buggy');
    await page.getByRole('button', { name: 'Run gallery scenario' }).click();
    await expect(page.getByTestId('gallery-verdict')).toContainText('FAIL:');
    await page.getByLabel('Gallery behavior').selectOption('fixed');
    await page.getByRole('button', { name: 'Run gallery scenario' }).click();
    await expect(page.getByTestId('gallery-verdict')).toContainText('PASS:');
  });
}
test('reset aborts gallery streams and clears later actions', async ({ page }) => {
  await page.goto('/?gallery');
  await page.getByRole('button', { name: 'Run gallery scenario' }).click();
  await expect(page.getByTestId('gallery-log')).toContainText('submitted');
  await page.getByRole('button', { name: 'Reset gallery' }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('gallery-verdict')).toHaveText('Ready');
  await expect(page.getByTestId('gallery-output')).toBeEmpty();
  await expect(page.getByTestId('gallery-log')).toHaveText('Waiting for replay.');
});

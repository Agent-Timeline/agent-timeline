import { test, expect } from '@playwright/test';
for (const mode of ['fixed', 'buggy']) test(`${mode}: cancellation against the standalone chat`, async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Request handling').selectOption(mode);
  await page.evaluate(() => {
    const seen = { cancelled: false, violation: false };
    (window as unknown as { observed: typeof seen }).observed = seen;
    document.getElementById('cancel')!.addEventListener('click', () => { seen.cancelled = true; });
    new MutationObserver(() => {
      if (seen.cancelled && document.getElementById('response')!.textContent!.includes('Weekend Atlas')) seen.violation = true;
    }).observe(document.getElementById('response')!, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#response')).toContainText('A possible title is');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#events')).toContainText('Stream ended');
  expect(await page.evaluate(() => (window as unknown as { observed: { violation: boolean } }).observed.violation)).toBe(mode === 'buggy');
  await expect(page.locator('#events')).toContainText(mode === 'fixed' ? 'late, ignored' : 'late, accepted');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
});
test('reset cleans up pending delivery and the next request completes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#events')).toContainText('Provider connected');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#response')).toBeEmpty();
  await expect(page.getByRole('status')).toHaveText('Ready');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  await expect(page.locator('#response')).toHaveText('A possible title is Weekend Atlas');
});

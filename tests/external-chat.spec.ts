import { test, expect } from '@playwright/test';

test('edited workbench scenario runs in the standalone app and returns failure then success', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Test target').selectOption('external');
  await expect(page.getByText('Connected. Run the edited scenario against this app.')).toBeVisible();
  await page.getByLabel('Application behavior').selectOption('buggy');
  await page.getByLabel('Event 2 time', { exact: true }).fill('900');
  await page.getByLabel('Event 2 text', { exact: true }).fill('Custom delayed answer');
  await page.getByLabel('Text that must stay absent after cancellation').fill('Custom delayed answer');
  await page.getByLabel('Cancel at (ms)', { exact: true }).fill('400');
  await page.getByLabel('Prompt', { exact: true }).fill('A new synthetic prompt');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(page.getByTestId('verdict')).toContainText('FAIL');
  await expect(page.getByTestId('event-log')).toContainText('900ms · text · late, accepted');
  await expect(page.getByTestId('observed-timeline')).toContainText('Cancel requested');
  const chat = page.frameLocator('iframe');
  await expect(chat.getByLabel('Your prompt')).toHaveValue('A new synthetic prompt');
  await expect(chat.locator('#response')).toContainText('Custom delayed answer');
  await expect(page.getByTestId('event-1')).toHaveClass(/event-failed/);
  await page.getByLabel('Application behavior').selectOption('fixed');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(page.getByTestId('verdict')).toContainText('PASS');
  await expect(chat.locator('#response')).not.toContainText('Custom delayed answer');
  await expect(chat.getByRole('status')).toHaveText('Cancelled');
  await expect(page.getByTestId('event-log')).toContainText('900ms · text · late, ignored');
});

test('workbench reset cancels an external run without a stale verdict', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Test target').selectOption('external');
  await expect(page.getByText('Connected. Run the edited scenario against this app.')).toBeVisible();
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  const chat = page.frameLocator('iframe');
  await expect(chat.locator('#events')).toContainText('Provider connected');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForTimeout(2100);
  await expect(page.getByTestId('verdict')).toContainText('Ready to verify');
  await expect(chat.locator('#response')).toBeEmpty();
  await expect(chat.getByRole('status')).toHaveText('Ready');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(page.getByTestId('verdict')).toContainText('PASS');
});

test('provider failure cannot become a passing external run', async ({ page }) => {
  await page.route('**/timeline/api/generate', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await page.getByLabel('Test target').selectOption('external');
  await expect(page.getByText('Connected. Run the edited scenario against this app.')).toBeVisible();
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(page.getByTestId('verdict')).toContainText('RUN ERROR', { timeout: 15000 });
});

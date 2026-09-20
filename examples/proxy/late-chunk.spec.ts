import { test, expect } from '@playwright/test';

// Set TIMELINE_CHAT_MODE=buggy to demonstrate a failing regression test.
test('cancelled response never displays a late chunk', async ({ page }) => {
  await page.goto('/'); // A normal app page, no iframe.
  await page.getByLabel('Request handling').selectOption(process.env.TIMELINE_CHAT_MODE ?? 'fixed');
  // Install before sending: remember even a brief appearance that is later removed.
  await page.evaluate(() => {
    const state = window as typeof window & { lateChunkSeen?: boolean; lateObserver?: MutationObserver };
    state.lateChunkSeen = false;
    state.lateObserver = new MutationObserver(() => {
      if (document.querySelector('#response')?.textContent?.includes('Weekend Atlas')) state.lateChunkSeen = true;
    });
    state.lateObserver.observe(document.querySelector('#response')!, { subtree:true, childList:true, characterData:true });
  });
  await page.getByRole('button', { name:'Send', exact:true }).click();
  await expect(page.locator('#events')).toContainText('Provider connected');
  await page.getByRole('button', { name:'Cancel', exact:true }).click();
  // Delivery evidence prevents a broken connection from passing as a fix.
  await expect(page.locator('#events')).toContainText('1100ms · text · late');
  await expect(page.locator('#events')).toContainText('Stream ended');
  const violation = await page.evaluate(() => {
    const state = window as typeof window & { lateChunkSeen?: boolean; lateObserver?: MutationObserver };
    state.lateObserver?.disconnect();
    return state.lateChunkSeen;
  });
  expect(violation, 'A late chunk appeared after cancellation').toBe(false);
});

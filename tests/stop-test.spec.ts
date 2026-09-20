import {test, expect} from '@playwright/test';
for (const target of ['demo','external']) test(`${target}: stop stays incomplete and replay obtains a fresh verdict`, async ({page})=>{
 await page.goto('/');
 await page.getByLabel('Test target',{exact:true}).selectOption(target);
 if (target === 'external') await expect(page.getByText('Connected. Run the edited scenario against this app.')).toBeVisible();
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();
 await expect(page.getByTestId('observed-timeline')).toContainText('Response received');
 await page.getByRole('button',{name:'Stop test',exact:true}).click();
 await expect(page.getByTestId('verdict')).toContainText('STOPPED · INCOMPLETE');
 await page.waitForTimeout(2000);
 await expect(page.getByTestId('verdict')).toContainText('STOPPED · INCOMPLETE');
 await page.getByRole('button',{name:'Replay again',exact:true}).click();
 await expect(page.getByTestId('verdict')).toContainText('PASS');
});

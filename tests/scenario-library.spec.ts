import {test,expect} from '@playwright/test';
test('save a built-in scenario, reload it as an executable runner config and manage copies',async({page})=>{
 await page.goto('/');await page.getByLabel('Scenario name',{exact:true}).fill('My cancellation');await page.getByRole('button',{name:'Save as new',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Saved scenario',exact:true})).toContainText('My cancellation');
 await page.getByLabel('Cancel at (ms)',{exact:true}).fill('750');await expect(page.getByTestId('library-status')).toBeVisible();
 page.once('dialog',d=>d.dismiss());await page.getByLabel('Workbench scenario').selectOption('recovery');await expect(page.getByLabel('Workbench scenario')).toHaveValue('cancel');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('button',{name:'Open saved scenario',exact:true}).click();await expect(page.getByRole('heading',{name:'Built-in cancel',exact:true})).toBeVisible();
 await expect(page.getByLabel('click #runner-cancel milliseconds',{exact:true})).toHaveValue('750');
 await page.getByRole('button',{name:'Run scenario',exact:true}).click();await expect(page.getByTestId('configured-verdict')).toHaveText('PASS',{timeout:15000});
 await page.getByLabel('Scenario name',{exact:true}).fill('Copy');await page.getByRole('button',{name:'Duplicate saved',exact:true}).click();
 await page.getByLabel('Scenario name',{exact:true}).fill('Renamed copy');await page.getByRole('button',{name:'Rename saved',exact:true}).click();await expect(page.getByRole('combobox',{name:'Saved scenario',exact:true})).toContainText('Renamed copy');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete saved',exact:true}).click();await expect(page.getByRole('combobox',{name:'Saved scenario',exact:true})).not.toContainText('Renamed copy');
 await page.reload();await expect(page.getByRole('combobox',{name:'Saved scenario',exact:true})).toContainText('My cancellation');
});
test('corrupted browser library is not overwritten',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('agent-timeline.scenarios.v1','broken'));
 await page.goto('/');await expect(page.getByRole('button',{name:'Save as new',exact:true})).toBeDisabled();expect(await page.evaluate(()=>localStorage.getItem('agent-timeline.scenarios.v1'))).toBe('broken');
});
test('storage failure never reports a successful save',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError')}});
 await page.goto('/');await page.getByLabel('Scenario name',{exact:true}).fill('Cannot save');await page.getByRole('button',{name:'Save as new',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Storage full');await expect(page.getByRole('combobox',{name:'Saved scenario',exact:true})).not.toContainText('Cannot save');
});

import {test,expect} from '@playwright/test';
test('recovery timeline edits drive a valid run and reject invalid sequences',async({page})=>{
 await page.goto('/?gallery');await page.getByLabel('Gallery scenario').selectOption('connection-recovery');
 await page.getByLabel('Disconnect stream (ms)',{exact:true}).fill('500');
 await expect(page.getByTestId('recovery-disconnect')).toContainText('500 ms');
 await page.getByRole('button',{name:'Run gallery scenario'}).click();
 await expect(page.getByTestId('gallery-verdict')).toContainText('PASS:');
 await page.getByLabel('Disconnect stream (ms)',{exact:true}).fill('950');
 await expect(page.getByRole('alert')).toContainText('Order events');
 await expect(page.getByRole('button',{name:'Run gallery scenario'})).toBeDisabled();
 await page.getByRole('button',{name:'Restore recovery timings'}).click();
 await expect(page.getByLabel('Disconnect stream (ms)',{exact:true})).toHaveValue('400');
});

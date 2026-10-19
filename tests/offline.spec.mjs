import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'allow'});
test('PWA reloads Javascript and CSS without connectivity after install',async ({page,context})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('premium-onboarding-complete','true'));
 await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:16000});
 await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
 await context.setOffline(true);
 try{
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
  await expect(page.locator('.g-brand strong')).toHaveText('Mi Presupuesto');
 }finally{await context.setOffline(false);}
});

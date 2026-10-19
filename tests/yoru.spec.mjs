import {test,expect} from '@playwright/test';
async function seed(page){
 await page.goto('/');
 await page.evaluate(()=>{
   localStorage.clear();
   localStorage.setItem('premium-onboarding-complete','true');
   localStorage.setItem('ux-selected-month','2026-10');
   localStorage.setItem('god-section','home');
 });
 await page.reload();
 await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
}
async function nav(page,section){
 await page.getByRole('navigation',{name:'Navegación principal'})
 .getByRole('button',{name:section}).click();
}
test.beforeEach(async ({page})=>{await seed(page);});
test('navigation: fits viewport, no obstructive duplicate launchers',async ({page})=>{
 for(const section of ['Inicio','Movimientos','Presupuesto','Préstamo','Más']){
  await nav(page,section);
  const m=await page.evaluate(()=>{
   const el=document.querySelector('.g-bottom-nav').getBoundingClientRect();
   return {width:document.documentElement.scrollWidth,viewport:innerWidth,bottom:el.bottom,top:el.top,height:innerHeight,floaters:[...document.querySelectorAll('.finance-hub-fab,.product-settings-button')].map(e=>getComputedStyle(e).display)};
  });
  expect(m.width,section+' horizontal overflow').toBeLessThanOrEqual(m.viewport+1);
  expect(m.bottom).toBeLessThanOrEqual(m.height+2);
  expect(m.top).toBeGreaterThanOrEqual(0);
  expect(m.floaters.every(x=>x==='none')).toBeTruthy();
  if(section!=='Más') await expect(page.locator('#month-close-host')).toBeHidden();
  else await expect(page.locator('#month-close-host')).toBeVisible();
 }
 await page.screenshot({path:'test-artifacts/yoru-'+test.info().project.name+'-more.png',fullPage:true});
});
test('expense, budget editing and month persistence',async ({page})=>{
 await page.getByRole('button',{name:'Registrar gasto',exact:true}).click();
 let dialog=page.getByRole('dialog');
 await dialog.locator('input[type="number"]').first().fill('155.75');
 await dialog.locator('select').selectOption('Gasolina');
 await dialog.getByRole('button',{name:'Guardar gasto'}).click();
 await expect(dialog).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('expenses')||'[]').length)).toBe(1);
 await nav(page,'Presupuesto');
 const row=page.locator('.g-budget-card').filter({hasText:'Gasolina'});
 await expect(row).toContainText('155.75');
 const edit=page.getByRole('spinbutton',{name:'Límite mensual para Gasolina'});
 await edit.fill('1350');await edit.press('Tab');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('monthly-budgets')||'{}')['2026-10']?.Gasolina)).toBe(1350);
 await page.reload();await nav(page,'Presupuesto');
 await expect(page.getByRole('spinbutton',{name:'Límite mensual para Gasolina'})).toHaveValue('1350');
 await page.waitForTimeout(550);
 await page.screenshot({path:'test-artifacts/yoru-'+test.info().project.name+'-budget.png',fullPage:true});
});
test('income edit and delete are still functional',async ({page})=>{
 await nav(page,'Movimientos');
 await page.getByRole('button',{name:'Ingreso',exact:true}).click();
 let sheet=page.getByRole('dialog');
 await sheet.locator('input[type="number"]').first().fill('2500');
 await sheet.getByRole('button',{name:'Guardar ingreso'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('monthly-incomes')||'[]').length)).toBe(1);
 await page.getByRole('button',{name:'Editar movimiento'}).first().click();
 sheet=page.getByRole('dialog');
 await sheet.locator('input[type="number"]').first().fill('2700');
 await sheet.getByRole('button',{name:'Guardar cambios'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('monthly-incomes')||'[]')[0]?.amount)).toBe(2700);
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Eliminar movimiento'}).first().click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('monthly-incomes')||'[]').length)).toBe(0);
});
test('loan payment and undo preserve payment records',async ({page})=>{
 await nav(page,'Préstamo');
 await page.locator('.g-loan-pay').first().click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('expenses')||'[]').filter(e=>e.source==='scheduled-loan').length)).toBe(1);
 await page.locator('.g-paid-button').first().click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('expenses')||'[]').filter(e=>e.source==='scheduled-loan').length)).toBe(0);
});
test('More opens plans, settings and downloads local backup',async ({page})=>{
 await nav(page,'Más');
 await page.getByRole('button',{name:/Plan y metas/}).click();
 await expect(page.locator('.finance-drawer')).toBeVisible();
 await page.locator('.finance-close-button').click();
 await page.getByRole('button',{name:/Ajustes y reportes/}).click();
 await expect(page.getByRole('dialog',{name:'Configuración de la aplicación'})).toBeVisible();
 await page.locator('.product-panel>header>button').click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:/Crear respaldo/}).click();
 const downloadInfo=await download;
 expect(downloadInfo.suggestedFilename()).toMatch(/mi-presupuesto.*\.json$/);
});
test('zero month does not imply positive income',async ({page})=>{
 await expect(page.locator('.y-balance-block')).toContainText('Sin movimientos registrados este mes');
 await expect(page.locator('.y-balance-block')).not.toContainText('Ingresos por encima de gastos');
});

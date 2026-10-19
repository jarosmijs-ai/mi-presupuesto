import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'allow'});
test('installed PWA reloads its own JavaScript and CSS offline',async ({page,context})=>{
  // Seeding in an init script is safe across automatic service-worker reloads.
  await context.addInitScript(()=>{
    localStorage.setItem('premium-onboarding-complete','true');
  });
  const messages=[];
  page.on('console',msg=>{if(msg.type()==='error')messages.push(msg.text());});
  page.on('pageerror',err=>messages.push(String(err)));
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
  const controlled=await expect.poll(async()=>{
    try {
      return await page.evaluate(async()=>{
        const registrations=await navigator.serviceWorker.getRegistrations();
        const active=registrations.some(reg=>reg.active?.state==='activated');
        return Boolean(navigator.serviceWorker.controller||active);
      });
    } catch {return false;}
  },{timeout:30000}).toBe(true).then(()=>true).catch(()=>false);
  if(!controlled){
    const diag=await page.evaluate(async()=>{
      const regs=await navigator.serviceWorker.getRegistrations();
      const paths=['/','/index.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png','/sw.js'];
      const status=await Promise.all(paths.map(async path=>{try{return [path,(await fetch(path)).status]}catch(error){return [path,String(error)]}}));
      return {controlled:!!navigator.serviceWorker.controller,registrations:regs.map(r=>({scope:r.scope,installing:r.installing?.state,waiting:r.waiting?.state,active:r.active?.state})),cacheKeys:await caches.keys(),status};
    });
    console.log('PWA_INSTALL_DIAGNOSTIC',JSON.stringify({diag,messages}));
  }
  expect(controlled,'service worker should install before going offline').toBe(true);
  await page.reload();
  await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('yoru-offline-fixture','retained'));
  await context.setOffline(true);
  try {
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();
    await expect(page.locator('.g-brand strong')).toHaveText('Finance');
    expect(await page.evaluate(()=>localStorage.getItem('yoru-offline-fixture'))).toBe('retained');
  }finally{await context.setOffline(false);}
});

import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.mjs',
 timeout:30000,expect:{timeout:10000},retries:1,
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
 use:{baseURL:'http://127.0.0.1:4173',serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'samsung-mobile',use:{browserName:'chromium',viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true}},
  {name:'narrow-mobile',use:{browserName:'chromium',viewport:{width:360,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true}},
  {name:'desktop',use:{browserName:'chromium',viewport:{width:1280,height:850}}},
 ],
 webServer:{
  command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
  url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000
 }
});

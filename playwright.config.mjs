import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:true,
 workers:2,
 retries:0,
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:4175',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'desktop-chromium',testIgnore:'**/*-live.spec.mjs',use:{...devices['Desktop Chrome']}},
  {name:'mobile-chromium',testIgnore:'**/*-live.spec.mjs',use:{...devices['Pixel 7']}},
  ...(process.env.RUN_INTEGRATION==='1'&&process.env.WORKSPACE_BROWSER_INTEGRATION==='1' ?
   [{name:'backend-chromium',testMatch:'**/*-live.spec.mjs',use:{...devices['Desktop Chrome']}}] : []),
 ],
 webServer:{command:'npm run dev -- --port 4175 --strictPort',url:'http://127.0.0.1:4175',reuseExistingServer:false},
});

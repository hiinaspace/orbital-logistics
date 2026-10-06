import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1,
  use: {baseURL: 'http://127.0.0.1:4179', channel: 'chrome', headless: true},
  webServer: {command: `npm run ${process.env.PLAYWRIGHT_PREVIEW === '1' ? 'preview' : 'dev'} -- --port 4179 --strictPort`, url:'http://127.0.0.1:4179', reuseExistingServer:false}
});

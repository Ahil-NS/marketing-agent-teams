import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:3847',
    headless: false, // Show the browser so you can see progress
    viewport: { width: 1400, height: 900 },
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
})

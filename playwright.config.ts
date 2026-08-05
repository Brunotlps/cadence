import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // impede test.only esquecido de passar no CI
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  // 5s default é curto pro primeiro request de cada rota em dev (Turbopack
  // compila sob demanda) somado à latência real de rede pro Supabase/Resend
  // nas Server Actions de auth — sem isso, os primeiros asserts de URL do
  // fluxo de auth flakeiam.
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
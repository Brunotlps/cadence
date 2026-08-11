import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// O web server do Next carrega .env.local sozinho, mas o processo do runner
// Playwright não. Carrega as credenciais de teste uma vez aqui para que todos os
// specs avaliem os mesmos guards, sem cada arquivo duplicar setup.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Os cenários usam o Supabase hospedado e cada fixture autentica pelo fluxo
  // real. Um worker evita rajadas concorrentes no rate limit do Auth.
  workers: 1,
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

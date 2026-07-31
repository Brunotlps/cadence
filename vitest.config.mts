import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"], // E2E roda pelo Playwright, não pelo Vitest
    globals: true,
  },
});
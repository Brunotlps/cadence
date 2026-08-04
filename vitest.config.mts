import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"], // E2E roda pelo Playwright, não pelo Vitest
    globals: true,
    // Os testes de compliance rodam contra o projeto Supabase real (free
    // tier). Em paralelo, chamadas concorrentes de admin.createUser entre
    // arquivos de teste esgotam limite de conexão e os testes falham por
    // timeout de forma intermitente, não por regressão real.
    fileParallelism: false,
  },
});
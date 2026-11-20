import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  // tests/db needs a running local Supabase: run it with pnpm test:db.
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/db/**", "node_modules/**"], environment: "node", env: { TZ: "UTC" } },
})

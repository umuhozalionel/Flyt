import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Tests against the local Supabase started with the CLI (npx supabase start, then npx supabase db reset).
// They change data, so run npx supabase db reset before each run. Keys come from .env.local.
try {
  process.loadEnvFile(".env.local")
} catch {
  // No .env.local: the tests fall back to the local URL and need the key in the environment.
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    testTimeout: 60_000,
  },
})

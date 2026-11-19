import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Screens must not import mock data or a backend directly; everything goes through lib/api.ts.
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/mock-data", "@/lib/data/*", "**/mock-data", "@supabase/*"], message: "Screens read and write data only through lib/api.ts." }] },
      ],
    },
  },
  {
    files: ["lib/**", "tests/**", "supabase/**", "scripts/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/database.types.ts"]),
])

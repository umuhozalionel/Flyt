import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { placesSql, seedSql, testOtpToml } from "../scripts/supabase-sql"

// The Supabase reference data, seed and test SMS codes are generated from the app's own data.
// This test fails when they drift. To regenerate: UPDATE_SQL=1 pnpm vitest run tests/supabase-sync.test.ts
const root = join(__dirname, "..", "supabase")
const files = { places: join(root, "migrations", "20261119000200_places.sql"), seed: join(root, "seed.sql") }
const update = process.env.UPDATE_SQL === "1"

describe("Supabase files match the app data", () => {
  test("places migration", () => {
    if (update) writeFileSync(files.places, placesSql())
    expect(readFileSync(files.places, "utf8")).toBe(placesSql())
  })
  test("seed.sql", () => {
    if (update) writeFileSync(files.seed, seedSql())
    expect(readFileSync(files.seed, "utf8")).toBe(seedSql())
  })
  test("every seeded phone has the local test SMS code", () => {
    const config = readFileSync(join(root, "config.toml"), "utf8")
    for (const line of testOtpToml().split("\n")) expect(config).toContain(line)
  })
})

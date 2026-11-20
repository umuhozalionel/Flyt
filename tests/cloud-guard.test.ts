import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cloudProblems } from "../scripts/cloud-guard.mjs"

const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8")
const withoutTestCodes = config.replace(/\[auth\.sms\.test_otp\][\s\S]*?(?=\n\[)/, "[auth.sms.test_otp]\n")

describe("test sign-in code stays local", () => {
  it("blocks a cloud push while config.toml has test codes", () => {
    expect(cloudProblems(config, {})).toHaveLength(1)
  })
  it("passes once the test codes are taken out", () => {
    expect(cloudProblems(withoutTestCodes, {})).toEqual([])
  })
  it("blocks dev sign-in against a cloud URL, allows it locally", () => {
    expect(cloudProblems(withoutTestCodes, { NEXT_PUBLIC_DEV_SIGNIN: "true", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toHaveLength(1)
    expect(cloudProblems(withoutTestCodes, { NEXT_PUBLIC_DEV_SIGNIN: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toEqual([])
  })
})

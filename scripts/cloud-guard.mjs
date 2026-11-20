// Cloud safety check. Run before anything is pushed to a cloud Supabase project (pnpm cloud:check).
// Test sign-in codes (supabase/config.toml [auth.sms.test_otp]) and the dev email sign-in are for local Supabase only.
// `supabase config push` would copy the test codes to the cloud project, so it must only run through `pnpm cloud:config-push`,
// which refuses while any test code or dev switch is present.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Problems that block a cloud push. Empty means safe. */
export function cloudProblems(configToml, env = {}) {
  const problems = []
  const lines = configToml.split(/\r?\n/)
  let section = ""
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim()
    if (!line) continue
    const header = line.match(/^\[([^\]]+)\]$/)
    if (header) {
      section = header[1].trim()
      continue
    }
    if (section === "auth.sms.test_otp" && /=/.test(line)) {
      problems.push("supabase/config.toml has test sign-in codes ([auth.sms.test_otp]). They work on local Supabase only and must never reach a cloud project.")
      break
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)
  if (env.NEXT_PUBLIC_DEV_SIGNIN === "true" && !local) problems.push("NEXT_PUBLIC_DEV_SIGNIN=true is set for a cloud project. Dev sign-in is local only.")
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8")
  const problems = cloudProblems(config, process.env)
  if (problems.length) {
    for (const problem of problems) console.error(`Blocked: ${problem}`)
    process.exit(1)
  }
  console.log("Cloud check passed.")
}

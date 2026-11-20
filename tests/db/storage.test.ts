import { createClient } from "@supabase/supabase-js"
import { describe, expect, test } from "vitest"

// Document files (ID, criminal record certificate...) are in a private bucket. Only the driver, their firm admin and
// platform admins can open one, through a link that lasts 60 seconds. Signs in with the local test SMS code.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const client = () => createClient(url, key, { auth: { persistSession: false } })
async function as(phone: string) {
  const c = client()
  const { error } = await c.auth.verifyOtp({ phone, token: "123456", type: "sms" })
  if (error) throw error
  return c
}
const path = `driver-3/driving_licence/test-${Date.now()}.pdf`
const file = new Blob([new Uint8Array([37, 80, 68, 70])], { type: "application/pdf" })

describe.skipIf(!key)("private document files", () => {
  test("upload, review link per role, and no public access", async () => {
    const driver = await as("+250788330112") // driver-3, firm-1
    expect((await driver.storage.from("documents").upload(path, file, { contentType: "application/pdf" })).error).toBeNull()
    expect((await driver.storage.from("documents").upload("driver-4/driving_licence/x.pdf", file, { contentType: "application/pdf" })).error).not.toBeNull()
    const link = async (c: ReturnType<typeof client>) => !!(await c.storage.from("documents").createSignedUrl(path, 60)).data?.signedUrl
    expect(await link(driver)).toBe(true)
    expect(await link(await as("+250788200002"))).toBe(true) // firm-1 admin
    expect(await link(await as("+250788200001"))).toBe(true) // platform admin
    expect(await link(await as("+250788200003"))).toBe(false) // firm-2 admin
    expect(await link(await as("+250788600101"))).toBe(false) // company admin
    expect(await link(client())).toBe(false) // not signed in
    expect((await fetch(`${url}/storage/v1/object/public/documents/${path}`)).ok).toBe(false)
  })
})

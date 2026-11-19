import type { DataSource } from "./types"

// Supabase data source. Built in Phase 6 (migrations, RLS, RPC functions, realtime, auth).
// Until then, NEXT_PUBLIC_DATA_SOURCE=supabase fails loudly instead of showing mock data.
const notReady = "The Supabase data source is not built yet. Set NEXT_PUBLIC_DATA_SOURCE=mock."

export const supabaseSource = new Proxy({} as DataSource, {
  get(_target, key) {
    if (key === "subscribe") return () => () => undefined
    return () => Promise.reject(new Error(notReady))
  },
})

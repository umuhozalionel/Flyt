"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { AdminSignIn } from "@/components/shared/admin-sign-in"
import * as api from "@/lib/api"
import { dataSource } from "@/lib/config"
import type { AdminUser } from "@/lib/types"
import { useLive } from "@/lib/use-live"
import { useStored } from "@/lib/use-stored"

interface CompanyContextValue {
  /** Company admins the demo switcher offers. */
  admins: AdminUser[]
  admin?: AdminUser
  companyId?: string
  setAdminId: (id: string) => void
  toast: (message: string) => void
}

const CompanyContext = createContext<CompanyContextValue>({ admins: [], setAdminId: () => undefined, toast: () => undefined })
const ADMIN_KEY = "flyt-company-admin"

export function CompanyProvider({ children, toast }: { children: ReactNode; toast: (message: string) => void }) {
  // Mock: a demo switcher over every company admin. Supabase: only the signed-in person's own company roles.
  const { data } = useLive(() => (dataSource === "supabase" ? api.getSignedInAdmins("company") : api.getAdmins()), ["admins"])
  const [adminId, setAdminId] = useStored<string>(ADMIN_KEY, "admin-4")
  const value = useMemo(() => {
    const admins = (data ?? []).filter((item) => item.role === "company_admin")
    const admin = admins.find((item) => item.id === adminId) ?? admins[0]
    return { admins, admin, companyId: admin?.companyId, setAdminId, toast }
  }, [data, adminId, setAdminId, toast])
  if (dataSource === "supabase" && data && !data.length) return <AdminSignIn portal="company" toast={toast} onSignedIn={() => window.location.reload()} />
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export const useCompany = () => useContext(CompanyContext)

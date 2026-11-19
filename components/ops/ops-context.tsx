"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import * as api from "@/lib/api"
import { scopeFor, type OpsScope } from "@/lib/ops"
import type { AdminUser } from "@/lib/types"
import { useLive } from "@/lib/use-live"
import { useStored } from "@/lib/use-stored"
import { useToastMessage } from "@/components/shared/toast"

interface OpsContextValue {
  /** Ops users the demo role switcher offers: platform admins and firm admins. */
  admins: AdminUser[]
  admin?: AdminUser
  scope: OpsScope
  isPlatform: boolean
  setAdminId: (id: string) => void
  toast: (message: string) => void
}

const OpsContext = createContext<OpsContextValue>({ admins: [], scope: {}, isPlatform: true, setAdminId: () => undefined, toast: () => undefined })

const ADMIN_KEY = "flyt-ops-admin"

export function OpsProvider({ children, toast }: { children: ReactNode; toast: (message: string) => void }) {
  const { data } = useLive(api.getAdmins, ["admins"])
  const [adminId, setAdminId] = useStored<string>(ADMIN_KEY, "admin-1")
  const value = useMemo(() => {
    const admins = (data ?? []).filter((item) => item.role === "platform_admin" || item.role === "firm_admin")
    const admin = admins.find((item) => item.id === adminId) ?? admins.find((item) => item.role === "platform_admin")
    return { admins, admin, scope: scopeFor(admin), isPlatform: admin?.role !== "firm_admin", setAdminId, toast }
  }, [data, adminId, setAdminId, toast])
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>
}

export function useOps() {
  return useContext(OpsContext)
}

export { useToastMessage }

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

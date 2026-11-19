import { Navigation2 } from "lucide-react"
import en from "@/lib/i18n/en"

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-black tracking-tight ${small ? "text-xl" : "text-3xl"}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Navigation2 className="size-5" strokeWidth={2.8} />
      </span>
      {en["brand.name"]}
    </span>
  )
}

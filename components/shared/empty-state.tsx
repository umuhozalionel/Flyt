import { MapPin, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** A friendly "nothing here yet" block, with an optional next step. */
export function EmptyState({ title, detail, action, icon: Icon = MapPin }: { title: string; detail: string; action?: { label: string; onClick: () => void }; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/50 p-7 text-center animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      <span className="mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{detail}</p>
      {action && (
        <Button className="mt-4 min-h-11" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

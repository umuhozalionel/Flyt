import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed p-7 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-secondary">
        <MapPin className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{detail}</p>
      {action && (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

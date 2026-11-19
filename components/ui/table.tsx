import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border bg-card">
      <table className={cn("w-full min-w-[640px] border-collapse text-sm", className)} {...props} />
    </div>
  )
}
export const THead = (props: ComponentProps<"thead">) => <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground" {...props} />
export const TBody = (props: ComponentProps<"tbody">) => <tbody className="divide-y" {...props} />
export const Th = ({ className, ...props }: ComponentProps<"th">) => <th scope="col" className={cn("px-3 py-2.5 font-semibold", className)} {...props} />
export const Td = ({ className, ...props }: ComponentProps<"td">) => <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />
export const Tr = ({ className, ...props }: ComponentProps<"tr">) => <tr className={cn("transition hover:bg-secondary/40", className)} {...props} />

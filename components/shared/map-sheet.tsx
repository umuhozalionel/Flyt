"use client"

import { animate, motion, useDragControls, useMotionValue } from "motion/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n"
import { haptic } from "@/lib/haptics"

/**
 * The bottom sheet over a full-screen map. Drag the handle (or tap it) to lower the sheet and see more of the map,
 * and drag it up again. The content scrolls inside when it is taller than the space.
 */
export function MapSheet({ children, label, peek = 132, maxShare = 0.82, onHeight }: { children: ReactNode; label: string; peek?: number; maxShare?: number; onHeight?: (visible: number) => void }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [lowered, setLowered] = useState(false)
  const y = useMotionValue(0)
  const controls = useDragControls()
  const dragged = useRef(false)
  const travel = Math.max(0, height - peek)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void animate(y, lowered ? travel : 0, { type: "spring", stiffness: 420, damping: 40 })
    onHeight?.(lowered ? Math.min(peek, height) : height)
  }, [lowered, travel, y, height, peek, onHeight])

  function settle(goDown: boolean) {
    if (goDown !== lowered) haptic("light")
    setLowered(goDown)
    void animate(y, goDown ? travel : 0, { type: "spring", stiffness: 420, damping: 40 })
  }

  return (
    <motion.section
      ref={box}
      aria-label={label}
      style={{ y, maxHeight: `${maxShare * 100}%` }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: travel }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={(_event, info) => settle(info.velocity.y > 300 || (info.velocity.y > -300 && y.get() > travel / 2))}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[28px] border-t bg-background shadow-[0_-12px_40px_rgb(0_0_0/0.14)]"
    >
      <button
        type="button"
        onPointerDown={(event) => controls.start(event)}
        onClick={() => {
          if (!dragged.current) settle(!lowered)
          dragged.current = false
        }}
        aria-expanded={!lowered}
        aria-label={lowered ? t("sheet.raise") : t("sheet.lower")}
        className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="h-1.5 w-11 rounded-full bg-foreground/20" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </motion.section>
  )
}

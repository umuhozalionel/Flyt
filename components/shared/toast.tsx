"use client"

import { useCallback, useEffect, useState } from "react"

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timer)
  }, [message, onClose])
  return (
    <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background shadow-xl">
      {message}
    </div>
  )
}

export function useToastMessage() {
  const [message, setMessage] = useState("")
  const clear = useCallback(() => setMessage(""), [])
  return { message, toast: setMessage, clear }
}

/** A grey placeholder while data loads. It pulses, unless the device asks for reduced motion. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-secondary motion-reduce:animate-none ${className}`} />
}

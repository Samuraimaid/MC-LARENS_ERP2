import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef(({
  className,
  children,
  autoScrollOnEdge = true,
  edgeThreshold = 36,
  edgeSpeed = 12,
  ...props
}, ref) => {
  const viewportRef = React.useRef(null)
  const frameRef = React.useRef(null)
  const directionRef = React.useRef(0)

  const stopAutoScroll = React.useCallback(() => {
    directionRef.current = 0
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!autoScrollOnEdge) return undefined
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const tick = () => {
      if (!viewport || directionRef.current === 0) {
        frameRef.current = null
        return
      }
      viewport.scrollTop += directionRef.current * edgeSpeed
      frameRef.current = requestAnimationFrame(tick)
    }

    const startAutoScroll = (dir) => {
      directionRef.current = dir
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    const handlePointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return
      const rect = viewport.getBoundingClientRect()
      const y = event.clientY - rect.top
      if (y <= edgeThreshold) {
        startAutoScroll(-1)
        return
      }
      if (y >= rect.height - edgeThreshold) {
        startAutoScroll(1)
        return
      }
      stopAutoScroll()
    }

    const handlePointerLeave = () => {
      stopAutoScroll()
    }

    viewport.addEventListener("pointermove", handlePointerMove)
    viewport.addEventListener("pointerleave", handlePointerLeave)

    return () => {
      stopAutoScroll()
      viewport.removeEventListener("pointermove", handlePointerMove)
      viewport.removeEventListener("pointerleave", handlePointerLeave)
    }
  }, [autoScrollOnEdge, edgeSpeed, edgeThreshold, stopAutoScroll])

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}>
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }

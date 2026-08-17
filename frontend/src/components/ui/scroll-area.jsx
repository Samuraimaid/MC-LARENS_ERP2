import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

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

const ScrollArea = React.forwardRef(({
  className,
  children,
  autoScrollOnEdge = false,
  edgeThreshold = 72,
  edgeSpeed = 16,
  ...props
}, ref) => {
  const viewportRef = React.useRef(null)
  const autoScrollFrameRef = React.useRef(null)

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!autoScrollOnEdge) return undefined
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const handlePointerMove = (e) => {
      const rect = viewport.getBoundingClientRect()
      if (e.clientY < rect.top || e.clientY > rect.bottom) {
        stopAutoScroll()
        return
      }

      const distanceFromTop = e.clientY - rect.top
      const distanceFromBottom = rect.bottom - e.clientY

      let direction = 0
      let intensity = 0

      if (distanceFromTop < edgeThreshold) {
        direction = -1
        intensity = 1 - Math.max(0, distanceFromTop) / edgeThreshold
      } else if (distanceFromBottom < edgeThreshold) {
        direction = 1
        intensity = 1 - Math.max(0, distanceFromBottom) / edgeThreshold
      }

      if (direction !== 0 && intensity > 0) {
        stopAutoScroll()
        const step = () => {
          viewport.scrollTop += direction * edgeSpeed * intensity
          autoScrollFrameRef.current = requestAnimationFrame(step)
        }
        autoScrollFrameRef.current = requestAnimationFrame(step)
      } else {
        stopAutoScroll()
      }
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

export { ScrollArea, ScrollBar }

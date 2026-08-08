import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Mobile-first dialog shell:
 * - Fits viewport width with side gutters (no horizontal clip)
 * - Caps height with dvh + safe-area so content scrolls instead of cutting off
 * - Rounded, touch-friendly close control
 */
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 grid gap-4 border-0 bg-white text-slate-800 shadow-2xl outline-none dark:bg-slate-950 dark:text-slate-100",
        // Mobile gutters; callers may override max-w-* (tailwind-merge)
        "w-[calc(100vw-1.25rem)] max-w-lg",
        // Height: never exceed visible viewport (mobile chrome / notches)
        "max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))]",
        "overflow-y-auto overscroll-contain",
        "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        "p-5 sm:p-7",
        // Soft status-card look
        "rounded-xl sm:rounded-2xl",
        "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=open]:slide-in-from-bottom-2 sm:data-[state=open]:slide-in-from-bottom-0",
        className
      )}
      {...props}>
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-3 top-3 z-10 rounded-full p-1.5",
          "opacity-70 ring-offset-background",
          "transition-all duration-200 ease-out",
          "hover:opacity-100 hover:bg-slate-100 hover:scale-110 hover:shadow-sm",
          "active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:pointer-events-none",
          "touch-manipulation min-h-9 min-w-9 flex items-center justify-center",
          "dark:hover:bg-slate-800",
        )}>
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "flex w-full flex-col-reverse gap-2",
      "sm:flex-row sm:justify-end sm:gap-2",
      "pb-[max(0px,env(safe-area-inset-bottom,0px))]",
      className
    )}
    {...props}
  >
    {React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child
      // Make footer actions full-width and tall enough for touch on mobile
      return React.cloneElement(child, {
        className: cn(
          "status-dialog-btn w-full sm:w-auto min-h-11 touch-manipulation",
          child.props.className,
        ),
      })
    })}
  </div>
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

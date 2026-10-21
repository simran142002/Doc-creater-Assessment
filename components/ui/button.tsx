import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/** Recipes live in app/globals.css (.btn / .icon-btn), ported 1:1 from the prototype. */
const buttonVariants = cva("", {
  variants: {
    variant: {
      default: "btn",
      primary: "btn btn--primary",
      ghost: "btn btn--ghost",
      danger: "btn btn--danger",
      icon: "icon-btn",
    },
    size: {
      default: "",
      sm: "btn--sm",
      lg: "btn--lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(!asChild && { type })}
      {...props}
    />
  )
}

export { Button, buttonVariants }

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-text)] text-[var(--color-base)]",
        secondary: "bg-[var(--color-surface-hover)] text-[var(--color-text)]",
        destructive: "border-destructive bg-background text-destructive",
        outline: "bg-transparent text-[var(--color-text)]",
        ghost: "border-transparent bg-transparent text-[var(--color-text-muted)]",
        link: "border-transparent bg-transparent text-[var(--color-accent)] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Badge({ className, variant = "default", asChild = false, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }

"use client"

import * as ProgressPrimitive from "@radix-ui/react-progress"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Progress({ className, value = 0, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const indicatorColor = safeValue > 60 ? "bg-zinc-300" : safeValue > 30 ? "bg-amber-500" : "bg-red-600"

  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("relative h-1.5 w-full overflow-hidden rounded-none bg-zinc-800", className)} value={safeValue} {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full transition-all duration-500 ease-in-out", indicatorColor)}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

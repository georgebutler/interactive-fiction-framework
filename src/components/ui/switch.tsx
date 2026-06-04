import * as React from "react"

import { cn } from "@/lib/utils"

function Switch({ className, checked, defaultChecked, onCheckedChange, disabled, size = "default", ...props }: Omit<React.ComponentProps<"button">, "onChange"> & { checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void; size?: "sm" | "default" }) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(defaultChecked))
  const isChecked = checked ?? uncontrolledChecked

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-size={size}
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center border border-[var(--color-border)] transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[state=checked]:bg-[var(--color-text)] data-[state=unchecked]:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) return
        const nextChecked = !isChecked
        setUncontrolledChecked(nextChecked)
        onCheckedChange?.(nextChecked)
      }}
      {...props}
    >
      <span className="pointer-events-none block bg-[var(--color-base)] ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0 group-data-[state=unchecked]/switch:bg-[var(--color-text)]" />
    </button>
  )
}

export { Switch }

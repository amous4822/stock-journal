"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { computeBiasReport } from "./actions"

interface Props {
  cooldownMinutes: number
}

export function RefreshReportButton({ cooldownMinutes }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localCooldown, setLocalCooldown] = useState(cooldownMinutes)

  function handleRefresh() {
    startTransition(async () => {
      const result = await computeBiasReport()
      if (result.ok) {
        toast.success("Bias report updated")
        setLocalCooldown(60)
      } else {
        toast.error(result.error)
      }
    })
  }

  const disabled = isPending || localCooldown > 0

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={disabled}
      className="shrink-0"
    >
      <RefreshCw className={cn("size-3.5 mr-1.5", isPending && "animate-spin")} />
      {isPending
        ? "Analyzing…"
        : localCooldown > 0
        ? `Refresh in ${localCooldown}m`
        : "Refresh Report"}
    </Button>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

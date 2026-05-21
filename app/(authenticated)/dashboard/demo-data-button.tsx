"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadDemoData } from "./actions"

export function DemoDataButton({ hasTrades }: { hasTrades: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await loadDemoData()
      if (result.ok) {
        toast.success("Demo data loaded! Hit Refresh Report on the Bias Report page.")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      <Database className="mr-1.5 size-3.5" />
      {isPending
        ? "Loading…"
        : hasTrades
          ? "Reset demo data"
          : "Load demo data"}
    </Button>
  )
}

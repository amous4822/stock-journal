"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadDemoData } from "./actions"

export function DemoDataButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await loadDemoData()
      if (result.ok) {
        toast.success("10 demo trades loaded! Explore the dashboard.")
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
      {isPending ? "Loading demo data…" : "Load demo data"}
    </Button>
  )
}

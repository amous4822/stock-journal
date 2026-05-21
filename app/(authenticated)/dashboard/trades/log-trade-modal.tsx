// Log Trade modal — form for creating a new trade entry.
// Uses react-hook-form + zodResolver for client-side validation before calling the server action.
"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn, toDatetimeLocal } from "@/lib/utils"
import { NSE_SYMBOLS } from "@/lib/constants/nse-symbols"
import { createTradeSchema, type CreateTradeInput } from "./schemas"
import { createTrade } from "./actions"

interface Props {
  floating?: boolean
}

export function LogTradeModal({ floating }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTradeInput>({
    // Cast needed: Zod v4's z.coerce.* produces `unknown` input types which
    // conflict with react-hook-form's generic inference. The runtime behavior is correct.
    resolver: zodResolver(createTradeSchema) as Resolver<CreateTradeInput>,
    defaultValues: {
      action: "buy",
      entryDate: toDatetimeLocal() as unknown as Date,
    },
  })

  const action = watch("action")

  async function onSubmit(data: CreateTradeInput) {
    const result = await createTrade(data)
    if (result.ok) {
      toast.success("Trade logged!", {
        description: `${data.symbol} ${data.action} × ${data.quantity} recorded`,
      })
      reset()
      setOpen(false)
      router.refresh()
    } else {
      toast.error("Couldn't log trade", { description: result.error })
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      reset()
      setOpen(false)
    }
  }

  return (
    <>
      {floating ? (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="size-14 rounded-full shadow-lg"
          aria-label="Log a new trade"
        >
          <Plus className="size-6" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" />
          Log Trade
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Trade</DialogTitle>
            <DialogDescription>
              Record your trade. The AI will tag your strategy and emotion automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            {/* Symbol */}
            <div className="space-y-1.5">
              <Label htmlFor="symbol">NSE Symbol</Label>
              <Input
                id="symbol"
                list="nse-symbols-list"
                placeholder="e.g. RELIANCE"
                autoComplete="off"
                className="uppercase"
                {...register("symbol")}
              />
              {/* Native datalist autocomplete — 89 symbols, no extra components needed */}
              <datalist id="nse-symbols-list">
                {NSE_SYMBOLS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {errors.symbol && (
                <p className="text-xs text-destructive">{errors.symbol.message}</p>
              )}
            </div>

            {/* Action toggle */}
            <div className="space-y-1.5">
              <Label>Action</Label>
              <input type="hidden" {...register("action")} />
              <div className="flex gap-2" role="group" aria-label="Trade action">
                <button
                  type="button"
                  onClick={() => setValue("action", "buy", { shouldValidate: true })}
                  className={cn(
                    "flex-1 rounded-md border py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    action === "buy"
                      ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={action === "buy"}
                >
                  ↑ Buy
                </button>
                <button
                  type="button"
                  onClick={() => setValue("action", "sell", { shouldValidate: true })}
                  className={cn(
                    "flex-1 rounded-md border py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    action === "sell"
                      ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={action === "sell"}
                >
                  ↓ Sell
                </button>
              </div>
              {errors.action && (
                <p className="text-xs text-destructive">{errors.action.message}</p>
              )}
            </div>

            {/* Quantity + Entry Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="100"
                  {...register("quantity")}
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entryPrice">Entry Price (₹)</Label>
                <Input
                  id="entryPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="2450.00"
                  {...register("entryPrice")}
                />
                {errors.entryPrice && (
                  <p className="text-xs text-destructive">{errors.entryPrice.message}</p>
                )}
              </div>
            </div>

            {/* Entry Date */}
            <div className="space-y-1.5">
              <Label htmlFor="entryDate">Entry Date &amp; Time</Label>
              <Input
                id="entryDate"
                type="datetime-local"
                {...register("entryDate")}
              />
              {errors.entryDate && (
                <p className="text-xs text-destructive">{errors.entryDate.message}</p>
              )}
            </div>

            {/* Entry Reasoning */}
            <div className="space-y-1.5">
              <Label htmlFor="entryReasoning">Why are you taking this trade?</Label>
              <VoiceTextarea
                id="entryReasoning"
                rows={3}
                placeholder="e.g. Reliance broke out of a 3-week consolidation on high volume. I'm targeting ₹2600 with a stop at ₹2380."
                value={watch("entryReasoning") ?? ""}
                onValueChange={(v) => setValue("entryReasoning", v, { shouldValidate: true })}
              />
              {errors.entryReasoning && (
                <p className="text-xs text-destructive">{errors.entryReasoning.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The AI reads this to tag your strategy and emotion.
              </p>
            </div>

            {/* Target + Stop */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plannedTargetPrice">Target Price (₹)</Label>
                <Input
                  id="plannedTargetPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="₹2600 — your exit target"
                  {...register("plannedTargetPrice")}
                />
                {errors.plannedTargetPrice && (
                  <p className="text-xs text-destructive">{errors.plannedTargetPrice.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plannedStopLoss">Stop Loss (₹)</Label>
                <Input
                  id="plannedStopLoss"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="₹2380 — your maximum loss"
                  {...register("plannedStopLoss")}
                />
                {errors.plannedStopLoss && (
                  <p className="text-xs text-destructive">{errors.plannedStopLoss.message}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Log Trade"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Close Trade modal — collects exit price, date, and reasoning, then calls closeTrade action.
"use client"

import { useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { X, Loader2 } from "lucide-react"
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
import { toDatetimeLocal } from "@/lib/utils"
import { closeTradeFormSchema, type CloseTradeFormInput } from "./schemas"
import { closeTrade } from "./actions"

interface Props {
  tradeId: string
}

export function CloseTradeModal({ tradeId }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CloseTradeFormInput>({
    // Cast needed: Zod v4 z.coerce.* produces unknown input types, incompatible
    // with react-hook-form's generic. Runtime behavior is correct.
    resolver: zodResolver(closeTradeFormSchema) as Resolver<CloseTradeFormInput>,
    defaultValues: {
      exitDate: toDatetimeLocal() as unknown as Date,
    },
  })

  const exitReasoning = useWatch({ control, name: "exitReasoning" })

  async function onSubmit(data: CloseTradeFormInput) {
    // tradeId comes from props, not the form — it's injected here so the form
    // schema (closeTradeFormSchema) stays tradeId-free, avoiding a hidden-input
    // sync issue where react-hook-form never fires onChange on hidden fields.
    const result = await closeTrade({ ...data, tradeId })
    if (result.ok) {
      toast.success("Trade closed!", {
        description: `Realized P&L recorded. Check the trade detail for AI tags.`,
      })
      reset()
      setOpen(false)
      router.refresh()
    } else {
      toast.error("Couldn't close trade", { description: result.error })
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
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <X className="mr-1.5 size-3.5" />
        Close
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Trade</DialogTitle>
            <DialogDescription>
              Record your exit. The AI will classify the reason and check for plan deviation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            {/* Exit Price */}
            <div className="space-y-1.5">
              <Label htmlFor="exitPrice">Exit Price (₹)</Label>
              <Input
                id="exitPrice"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="2580.00"
                {...register("exitPrice")}
              />
              {errors.exitPrice && (
                <p className="text-xs text-destructive">{errors.exitPrice.message}</p>
              )}
            </div>

            {/* Exit Date */}
            <div className="space-y-1.5">
              <Label htmlFor="exitDate">Exit Date &amp; Time</Label>
              <Input
                id="exitDate"
                type="datetime-local"
                {...register("exitDate")}
              />
              {errors.exitDate && (
                <p className="text-xs text-destructive">{errors.exitDate.message}</p>
              )}
            </div>

            {/* Exit Reasoning */}
            <div className="space-y-1.5">
              <Label htmlFor="exitReasoning">What made you close this?</Label>
              <VoiceTextarea
                id="exitReasoning"
                rows={3}
                placeholder="e.g. Hit my ₹2600 target as planned. Stock looked extended and I didn't want to give back gains."
                value={exitReasoning ?? ""}
                onValueChange={(v) => setValue("exitReasoning", v, { shouldValidate: true })}
              />
              {errors.exitReasoning && (
                <p className="text-xs text-destructive">{errors.exitReasoning.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Be honest — the AI uses this to detect if you deviated from your plan.
              </p>
            </div>

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
                  "Close Trade"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Utility helpers shared across components — created by shadcn/ui init.
// Per CLAUDE.md anti-patterns: only add helpers here when there are 2+ callers.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn — merges Tailwind class strings, resolving conflicts via tailwind-merge.
 * Used throughout shadcn/ui components to combine base + variant + override classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// INR currency formatter — used in trades list, detail page, dashboard widget.
// Assumes all amounts are in Indian Rupees. International support is out of scope for v1.
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatINR(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(n)) return "—"
  return inrFormatter.format(n)
}

// Short date formatter for tables — e.g. "20 May 2025"
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return dateFormatter.format(d)
}

// datetime-local input value helper — converts Date → "YYYY-MM-DDTHH:mm"
export function toDatetimeLocal(d: Date = new Date()): string {
  return d.toISOString().slice(0, 16)
}

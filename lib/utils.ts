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

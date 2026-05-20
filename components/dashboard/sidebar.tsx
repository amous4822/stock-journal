// Sidebar navigation — desktop persistent, mobile hamburger slide-out.
// Client component because it tracks open/close state on mobile.
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { LayoutDashboard, TrendingUp, Brain, Menu, X, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/trades", label: "Trades", icon: TrendingUp, exact: false },
  { href: "/dashboard/bias-report", label: "Bias Report", icon: Brain, exact: false },
] as const

interface NavLinkProps {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
  onClick?: () => void
}

function NavLink({ href, label, icon: Icon, exact, onClick }: NavLinkProps) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  )
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-1 p-4">
      {/* Logo */}
      <div className="mb-4 px-3 py-2">
        <span className="text-lg font-bold tracking-tight">AlphaJournal</span>
        <p className="text-xs text-muted-foreground">Trade smarter, not harder</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavClick} />
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* ── Mobile: top bar with hamburger ──────────────────────── */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <span className="font-bold tracking-tight">AlphaJournal</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {/* ── Mobile: overlay + slide-in panel ────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-bold tracking-tight">AlphaJournal</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}

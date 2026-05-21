import { Sidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        <footer className="shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Built by Albin Joseph</span>
            <div className="flex gap-4">
              <a href="https://github.com/amous4822" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                GitHub
              </a>
              <a href="https://www.linkedin.com/in/albinj-ooz/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

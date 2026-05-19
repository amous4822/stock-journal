// Dashboard placeholder — Phase 2 will build out the full Shadow Portfolio widget
// and recent trades table. This stub satisfies the route so auth redirect works.
import { requireAuth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await requireAuth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome, {session.user.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground">
          Dashboard is coming in Phase 2. You are authenticated.
        </p>
        <p className="text-sm text-muted-foreground">
          User ID: <code className="font-mono text-xs">{session.user.id}</code>
        </p>
      </div>
    </main>
  )
}

// Authenticated route group layout — every route inside (authenticated)/ requires a session.
// requireAuth() redirects to /auth/signin for unauthenticated users.
// This is the outermost server component in the protected route tree.
import { requireAuth } from "@/lib/auth"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth gate — throws a Next.js redirect if no session.
  // All child pages/layouts inherit this protection without calling requireAuth() again.
  await requireAuth()

  return <>{children}</>
}

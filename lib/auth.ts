// Auth.js v5 configuration — Google OAuth with Drizzle adapter.
// This file is the single source of truth for auth config; never instantiate
// NextAuth elsewhere. The `requireAuth` helper enforces the auth gate.
import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema"
import { logger } from "@/lib/logger"

// Extend the built-in Session type so `session.user.id` is typed everywhere.
// Without this, `session.user.id` would be `string | undefined`.
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Drizzle adapter persists sessions and accounts in Neon.
  // We pass table references explicitly so the adapter works with our schema file
  // rather than auto-discovering tables by convention.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  callbacks: {
    // Forward the database user.id into the JWT/session so server actions
    // can do `WHERE user_id = session.user.id` without an extra DB lookup.
    session({ session, user }) {
      logger.info("auth:session", { userId: user.id })
      session.user.id = user.id
      return session
    },
  },

  events: {
    signIn({ user }) {
      // Log auth events but never log email (PII). Log the user ID only.
      logger.info("auth:signIn", { userId: user.id })
    },
    signOut(message) {
      // `message` is { session } for database sessions or { token } for JWT.
      if ("session" in message && message.session) {
        logger.info("auth:signOut", { userId: message.session.userId })
      }
    },
  },
})

/**
 * requireAuth — enforces authentication in server components and layouts.
 *
 * Redirects to /auth/signin if there is no active session.
 * Returns the session so callers can access `session.user.id` without a
 * second `auth()` call.
 *
 * For server actions use `requireAuthForAction()` instead — it returns a
 * discriminated union rather than redirecting, because actions cannot redirect.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth/signin")
  }
  return session
}

/**
 * requireAuthForAction — auth gate for use inside server actions.
 *
 * Returns `{ ok: false, error: "Unauthorized" }` instead of redirecting,
 * because server actions run after the page has rendered and cannot
 * issue HTTP redirects.
 */
export async function requireAuthForAction(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Unauthorized" }
  }
  return { ok: true, userId: session.user.id }
}

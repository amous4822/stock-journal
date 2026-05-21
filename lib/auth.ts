import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema"
import { logger } from "@/lib/logger"

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    session({ session, user }) {
      logger.info("auth:session", { userId: user.id })
      session.user.id = user.id
      return session
    },
  },
  events: {
    signIn({ user }) {
      logger.info("auth:signIn", { userId: user.id })
    },
    signOut(message) {
      if ("session" in message && message.session) {
        logger.info("auth:signOut", { userId: message.session.userId })
      }
    },
  },
})

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) redirect("/auth/signin")
  return session
}

export async function requireAuthForAction(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user) return { ok: false, error: "Unauthorized" }
  return { ok: true, userId: session.user.id }
}

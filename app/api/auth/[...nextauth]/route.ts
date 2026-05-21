// Auth.js v5 catch-all route handler — handles all /api/auth/* requests
// (signin, signout, callback, session, csrf, providers).
// force-dynamic prevents Next.js from statically evaluating this route at build
// time, which would fail without DATABASE_URL (sessions live in Neon).
export const dynamic = "force-dynamic"

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers

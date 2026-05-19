// Auth.js v5 catch-all route handler — handles all /api/auth/* requests
// (signin, signout, callback, session, csrf, providers).
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers

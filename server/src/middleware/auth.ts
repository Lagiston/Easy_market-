import type { NextFunction, Request, Response } from 'express'
import type { Role, User } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
    sessionToken?: string
  }
}

export const SESSION_COOKIE = 'session'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } })
    return res.status(401).json({ error: 'Session expired' })
  }

  req.user = session.user
  req.sessionToken = token
  next()
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}

// Blocks everything except password change until the seeded/reset password is replaced.
export function blockUntilPasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' })
  }
  next()
}

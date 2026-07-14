import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, SESSION_COOKIE } from '../middleware/auth.js'

const router = Router()

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 72) * 60 * 60 * 1000

function publicUser(user: { id: string; email: string; name: string; role: string; mustChangePassword: boolean }) {
  const { id, email, name, role, mustChangePassword } = user
  return { id, email, name, role, mustChangePassword }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
  })
  res.json({ user: publicUser(user) })
})

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.deleteMany({ where: { token: req.sessionToken } })
  res.clearCookie(SESSION_COOKIE)
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) })
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

  const user = req.user!
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return res.status(400).json({ error: 'New password must be different' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
      mustChangePassword: false,
    },
  })
  // Invalidate every other session for this user.
  await prisma.session.deleteMany({
    where: { userId: user.id, NOT: { token: req.sessionToken } },
  })
  res.json({ ok: true })
})

export default router

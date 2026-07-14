import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { blockUntilPasswordChanged, requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, blockUntilPasswordChanged, requireRole('ADMIN'))

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } })
  res.json({ users })
})

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'AGENT']),
  password: z.string().min(8),
})

router.post('/', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

  const email = parsed.data.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'A user with this email already exists' })
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      mustChangePassword: true,
    },
    select: userSelect,
  })
  res.status(201).json({ user })
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  isActive: z.boolean().optional(),
})

router.patch('/:id', async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  if (req.params.id === req.user!.id && parsed.data.isActive === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' })
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: userSelect,
  })
  // Deactivation kicks the user out immediately.
  if (parsed.data.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: user.id } })
  }
  res.json({ user })
})

export default router

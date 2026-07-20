import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { InquiryChannel, InquiryStatus, MessageSender, Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/require-auth";
import {
  addMessageSchema,
  assignInquirySchema,
  createInquirySchema,
  escalateInquirySchema,
  inquiryListQuerySchema,
} from "@es-market/core";

// Public inquiry endpoints; mounted at /api in index.ts.
export const inquiriesRouter = Router();

inquiriesRouter.post("/storefront/inquiries", async (req, res) => {
  const parsed = createInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { customerName, customerEmail, customerPhone, message, language } = parsed.data;

  const inquiry = await prisma.inquiry.create({
    data: {
      id: randomUUID(),
      channel: InquiryChannel.WEBSITE,
      customerName,
      customerEmail,
      customerPhone: customerPhone ?? null,
      language,
      messages: {
        create: [{ id: randomUUID(), sender: MessageSender.CUSTOMER, body: message }],
      },
    },
  });

  res.status(201).json({ inquiry: { id: inquiry.id } });
});

// Guest thread view for the chat widget — id is a non-enumerable random UUID
// (same precedent as order lookup codes), so no further ownership check is
// required. Response omits customer contact fields and assignedAgentId.
inquiriesRouter.get("/storefront/inquiries/:id", async (req, res) => {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }

  res.json({
    inquiry: {
      id: inquiry.id,
      status: inquiry.status,
      messages: inquiry.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
      })),
    },
  });
});

inquiriesRouter.post("/storefront/inquiries/:id/messages", async (req, res) => {
  const parsed = addMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id: req.params.id } });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  if (inquiry.status === InquiryStatus.CLOSED) {
    res.status(409).json({ error: "This conversation is closed" });
    return;
  }

  const message = await prisma.message.create({
    data: {
      id: randomUUID(),
      inquiryId: inquiry.id,
      sender: MessageSender.CUSTOMER,
      body: parsed.data.message,
    },
  });

  if (inquiry.status === InquiryStatus.RESOLVED) {
    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { status: InquiryStatus.OPEN },
    });
  }

  res.status(201).json({
    message: {
      id: message.id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt,
    },
  });
});

// --- Staff endpoints (any signed-in staff: ADMIN or AGENT) ---

const inquiryInclude = {
  assignedAgent: { select: { id: true, name: true } },
} as const;

const inquiryWithMessagesInclude = {
  ...inquiryInclude,
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
} as const;

inquiriesRouter.get("/inquiries", requireAuth, async (req, res) => {
  const parsed = inquiryListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { status, queue } = parsed.data;

  const queueWhere =
    queue === "mine"
      ? { assignedAgentId: req.user.id }
      : queue === "unassigned"
        ? { assignedAgentId: null }
        : {};

  const inquiries = await prisma.inquiry.findMany({
    where: { ...queueWhere, ...(status ? { status } : {}) },
    include: inquiryInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ inquiries });
});

inquiriesRouter.get<{ id: string }>("/inquiries/:id", requireAuth, async (req, res) => {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: req.params.id },
    include: inquiryWithMessagesInclude,
  });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  res.json({ inquiry });
});

// 404 when the inquiry doesn't exist, 409 when it exists but a guarded
// status-transition/claim updateMany matched nothing (wrong current state).
async function rejectMissingOrConflict(res: Response, id: string, conflictMessage: string) {
  const exists = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  res.status(409).json({ error: conflictMessage });
}

async function respondWithInquiry(res: Response, id: string) {
  const inquiry = await prisma.inquiry.findUniqueOrThrow({
    where: { id },
    include: inquiryInclude,
  });
  res.json({ inquiry });
}

// Race-safe: only succeeds if the inquiry was still unassigned.
inquiriesRouter.post<{ id: string }>("/inquiries/:id/claim", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.inquiry.updateMany({
    where: { id, assignedAgentId: null },
    data: { assignedAgentId: req.user.id },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "This inquiry has already been claimed");
    return;
  }
  await respondWithInquiry(res, id);
});

// Explicit (re)assignment or unassignment by any staff member — any staff role
// can be the handling agent, unlike Product.assignedAgentId's AGENT-only rule.
inquiriesRouter.post<{ id: string }>("/inquiries/:id/assign", requireAuth, async (req, res) => {
  const parsed = assignInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { id } = req.params;
  const { agentId } = parsed.data;

  if (agentId) {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.deletedAt) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }

  await prisma.inquiry.update({
    where: { id },
    data: { assignedAgentId: agentId ?? null },
  });
  await respondWithInquiry(res, id);
});

// Staff reply — doesn't reopen a RESOLVED inquiry (unlike the guest follow-up
// route), since replying to a resolved thread doesn't imply it's unresolved.
inquiriesRouter.post<{ id: string }>("/inquiries/:id/messages", requireAuth, async (req, res) => {
  const parsed = addMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id: req.params.id } });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  if (inquiry.status === InquiryStatus.CLOSED) {
    res.status(409).json({ error: "This conversation is closed" });
    return;
  }

  const message = await prisma.message.create({
    data: {
      id: randomUUID(),
      inquiryId: inquiry.id,
      sender: MessageSender.STAFF,
      authorUserId: req.user.id,
      body: parsed.data.message,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  // Bump the inquiry's updatedAt so it re-sorts to the top of the inbox — an
  // empty `data: {}` update doesn't actually issue a write, so set it explicitly.
  await prisma.inquiry.update({ where: { id: inquiry.id }, data: { updatedAt: new Date() } });

  res.status(201).json({ message });
});

// Hands the inquiry to a specific admin and stamps escalatedAt — orthogonal to
// `status` (an OPEN or RESOLVED inquiry can also be escalated); no de-escalate
// action in this pass.
inquiriesRouter.post<{ id: string }>("/inquiries/:id/escalate", requireAuth, async (req, res) => {
  const parsed = escalateInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { id } = req.params;
  const { agentId } = parsed.data;

  const admin = await prisma.user.findUnique({ where: { id: agentId } });
  if (!admin || admin.deletedAt || admin.role !== Role.ADMIN) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  if (inquiry.status === InquiryStatus.CLOSED) {
    res.status(409).json({ error: "Closed inquiries can't be escalated" });
    return;
  }

  await prisma.inquiry.update({
    where: { id },
    data: { assignedAgentId: agentId, escalatedAt: new Date() },
  });
  await respondWithInquiry(res, id);
});

inquiriesRouter.post<{ id: string }>("/inquiries/:id/resolve", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.inquiry.updateMany({
    where: { id, status: InquiryStatus.OPEN },
    data: { status: InquiryStatus.RESOLVED },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "Only open inquiries can be resolved");
    return;
  }
  await respondWithInquiry(res, id);
});

inquiriesRouter.post<{ id: string }>("/inquiries/:id/close", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.inquiry.updateMany({
    where: { id, status: { in: [InquiryStatus.OPEN, InquiryStatus.RESOLVED] } },
    data: { status: InquiryStatus.CLOSED },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "This inquiry is already closed");
    return;
  }
  await respondWithInquiry(res, id);
});

inquiriesRouter.post<{ id: string }>("/inquiries/:id/reopen", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.inquiry.updateMany({
    where: { id, status: { in: [InquiryStatus.RESOLVED, InquiryStatus.CLOSED] } },
    data: { status: InquiryStatus.OPEN },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "This inquiry is already open");
    return;
  }
  await respondWithInquiry(res, id);
});

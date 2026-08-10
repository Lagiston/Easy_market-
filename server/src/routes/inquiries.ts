import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import * as Sentry from "@sentry/node";
import {
  InquiryChannel,
  InquiryStatus,
  MessageSender,
  DraftStatus,
  Role,
  Prisma,
} from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { generateInquiryCode } from "../lib/inquiry-code";
import { requireAuth } from "../middleware/require-auth";
import { classifyInquiry } from "../lib/inquiry-classification";
import { normalizePhone } from "./orders";
import { sendSms, buildMessageReplySms } from "../lib/sms";
import {
  addMessageSchema,
  assignInquirySchema,
  createInquirySchema,
  escalateInquirySchema,
  inquiryListQuerySchema,
  inquiryLookupSchema,
} from "@es-market/core";

// Public inquiry endpoints; mounted at /api in index.ts.
export const inquiriesRouter = Router();

const CODE_RETRIES = 5;

// Fire-and-forget — an SMS failure must never affect the (already-sent) HTTP
// response for a successful reply. customerPhone is nullable (guest-only,
// email-submitted inquiries predating createInquirySchema's phone-required
// change may still lack one) — skip silently rather than throw.
function fireInquiryReplySms(inquiryId: string, phone: string | null, code: string, replyBody: string) {
  if (!phone) return;
  void sendSms(phone, buildMessageReplySms({ code, replyBody }), { inquiryId }).catch((error) => {
    console.error("Inquiry-reply SMS failed:", error);
    Sentry.captureException(error, { extra: { inquiryId } });
  });
}

inquiriesRouter.post("/storefront/inquiries", async (req, res) => {
  const parsed = createInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { topic, customerName, customerEmail, customerPhone, message, language } = parsed.data;

  for (let attempt = 0; attempt < CODE_RETRIES; attempt++) {
    const code = generateInquiryCode();
    try {
      const inquiry = await prisma.inquiry.create({
        data: {
          id: randomUUID(),
          code,
          channel: InquiryChannel.WEBSITE,
          topic,
          customerName,
          customerEmail: customerEmail ?? null,
          customerPhone,
          language,
          messages: {
            create: [{ id: randomUUID(), sender: MessageSender.CUSTOMER, body: message }],
          },
        },
      });

      void classifyInquiry(inquiry.id, message, language).catch((error) => {
        console.error("Unhandled inquiry classification error:", error);
        Sentry.captureException(error, { extra: { inquiryId: inquiry.id } });
      });

      res.status(201).json({ inquiry: { id: inquiry.id, code: inquiry.code } });
      return;
    } catch (err) {
      // Unique collision on the inquiry code — roll the dice again.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  res.status(500).json({ error: "Could not generate an inquiry code, please try again" });
});

// A guest (chat widget or Track page) must never see an AI_DRAFT message
// that hasn't actually been sent — a PENDING draft is unreviewed, and a
// DISCARDED one was never sent at all. AUTO_RESOLVED is the one AI_DRAFT
// case that was genuinely sent with no staff review, by design (see
// inquiry-auto-resolve.ts) — matches the exact "customer actually saw"
// rule dashboard-metrics.ts's avgFirstResponseMinutes already uses. This
// was previously unfiltered on both guest routes below — a real, if
// narrow, leak of unapproved AI drafts to the chat widget/Track page,
// caught while building the merged Track page's message-mode result.
function isGuestVisibleMessage(message: { sender: MessageSender; draftStatus: DraftStatus | null }) {
  return (
    message.sender !== MessageSender.AI_DRAFT || message.draftStatus === DraftStatus.AUTO_RESOLVED
  );
}

function serializeGuestMessages(
  messages: {
    sender: MessageSender;
    draftStatus: DraftStatus | null;
    id: string;
    body: string;
    createdAt: Date;
  }[],
) {
  return messages.filter(isGuestVisibleMessage).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.createdAt,
  }));
}

// Guest status lookup by inquiry code + phone (non-enumerable — both must
// match), mirroring orders.ts's /storefront/orders/lookup. Was code + email
// until createInquirySchema made phone required and email optional — phone
// is now the reliable identifier for both. Must be registered before the
// /storefront/inquiries/:id route below, otherwise Express would match
// "lookup" itself as the :id param.
inquiriesRouter.get("/storefront/inquiries/lookup", async (req, res) => {
  const parsed = inquiryLookupSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { code, phone } = parsed.data;

  const inquiry = await prisma.inquiry.findUnique({
    where: { code },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!inquiry || !inquiry.customerPhone || normalizePhone(inquiry.customerPhone) !== normalizePhone(phone)) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }

  res.json({
    inquiry: {
      id: inquiry.id,
      code: inquiry.code,
      status: inquiry.status,
      customerName: inquiry.customerName,
      createdAt: inquiry.createdAt,
      // Derived boolean, not the raw assignedAgentId — same "no customer
      // fields/staff identity leak" precedent as the rest of this route.
      // autoResolvedAt counts as "assigned" too: the inquiry is being
      // handled either way, the Track page's timeline doesn't distinguish
      // a human from the auto-resolve flow.
      assigned: inquiry.assignedAgentId !== null || inquiry.autoResolvedAt !== null,
      messages: serializeGuestMessages(inquiry.messages),
    },
  });
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
      messages: serializeGuestMessages(inquiry.messages),
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

  // Inquiries the AI auto-resolved (server/src/lib/inquiry-auto-resolve.ts)
  // never needed a human, so they're excluded from every queue/status view
  // here — always, not behind a toggle. Still reachable via GET /inquiries/:id
  // for audit.
  const inquiries = await prisma.inquiry.findMany({
    where: { ...queueWhere, ...(status ? { status } : {}), autoResolvedAt: null },
    include: inquiryInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ inquiries });
});

// Nav badge count: inquiries still open/resolved (not CLOSED) that are either
// unclaimed or escalated — the two "needs a human to look at this" signals.
// Registered before the /:id route below so "attention-count" isn't captured
// as an id.
inquiriesRouter.get("/inquiries/attention-count", requireAuth, async (req, res) => {
  const count = await prisma.inquiry.count({
    where: {
      status: { not: InquiryStatus.CLOSED },
      // Auto-resolved inquiries are unclaimed by design (nothing to claim),
      // so without this they'd otherwise inflate this "needs attention" badge.
      autoResolvedAt: null,
      OR: [{ assignedAgentId: null }, { escalatedAt: { not: null } }],
    },
  });
  res.json({ count });
});

// Resolves each message's sourceKbArticleIds into { id, title } pairs (English
// title; these are staff-facing citations, not a customer-facing surface, so
// no per-language lookup is needed). Tolerates ids whose article was later
// deleted — the historical citation still shows, just with a fallback label,
// rather than silently vanishing.
async function withResolvedSources<T extends { messages: { sourceKbArticleIds: string[] }[] }>(
  inquiry: T,
) {
  const articleIds = [...new Set(inquiry.messages.flatMap((m) => m.sourceKbArticleIds))];
  const articles = articleIds.length
    ? await prisma.kbArticle.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(articles.map((a) => [a.id, (a.title as { en: string }).en]));

  return {
    ...inquiry,
    messages: inquiry.messages.map((message) => ({
      ...message,
      sources: message.sourceKbArticleIds.map((articleId) => ({
        id: articleId,
        title: titleById.get(articleId) ?? "Deleted article",
      })),
    })),
  };
}

inquiriesRouter.get<{ id: string }>("/inquiries/:id", requireAuth, async (req, res) => {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: req.params.id },
    // smsLogs only on the single-inquiry detail route — staff-internal
    // visibility into whether the customer was actually notified of a
    // reply, same precedent as orders.ts's equivalent detail route.
    include: { ...inquiryWithMessagesInclude, smsLogs: { orderBy: { createdAt: "desc" } } },
  });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  res.json({ inquiry: await withResolvedSources(inquiry) });
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

// Used by the draft-review actions (approve/discard) so their response
// includes the full, updated thread with resolved sources — same shape as
// GET /inquiries/:id — for the client to swap in immediately.
async function respondWithInquiryThread(res: Response, id: string) {
  const inquiry = await prisma.inquiry.findUniqueOrThrow({
    where: { id },
    include: inquiryWithMessagesInclude,
  });
  res.json({ inquiry: await withResolvedSources(inquiry) });
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
  fireInquiryReplySms(inquiry.id, inquiry.customerPhone, inquiry.code, parsed.data.message);
});

// Approve an AI_DRAFT message: mints a new STAFF message with the (possibly
// edited) text — the draft row itself stays immutable history, per Message's
// existing no-mutation convention — and marks the draft SENT_UNEDITED or
// SENT_EDITED depending on whether the agent changed the text.
inquiriesRouter.post<{ id: string; messageId: string }>(
  "/inquiries/:id/messages/:messageId/approve",
  requireAuth,
  async (req, res) => {
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { id, messageId } = req.params;

    const inquiry = await prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      res.status(404).json({ error: "Inquiry not found" });
      return;
    }
    if (inquiry.status === InquiryStatus.CLOSED) {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }

    const draft = await prisma.message.findFirst({
      where: { id: messageId, inquiryId: id, sender: MessageSender.AI_DRAFT },
    });
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const wasEdited = parsed.data.message.trim() !== draft.body.trim();
    const updated = await prisma.message.updateMany({
      where: { id: messageId, inquiryId: id, draftStatus: DraftStatus.PENDING },
      data: { draftStatus: wasEdited ? DraftStatus.SENT_EDITED : DraftStatus.SENT_UNEDITED },
    });
    if (updated.count === 0) {
      res.status(409).json({ error: "This draft has already been reviewed" });
      return;
    }

    await prisma.message.create({
      data: {
        id: randomUUID(),
        inquiryId: id,
        sender: MessageSender.STAFF,
        authorUserId: req.user.id,
        body: parsed.data.message,
        sourceDraftMessageId: draft.id,
      },
    });
    await prisma.inquiry.update({ where: { id }, data: { updatedAt: new Date() } });

    await respondWithInquiryThread(res, id);
    fireInquiryReplySms(inquiry.id, inquiry.customerPhone, inquiry.code, parsed.data.message);
  },
);

// Discard an AI_DRAFT message without sending it — the agent will write a
// reply manually via the existing reply box. No new message is created.
inquiriesRouter.post<{ id: string; messageId: string }>(
  "/inquiries/:id/messages/:messageId/discard",
  requireAuth,
  async (req, res) => {
    const { id, messageId } = req.params;

    const inquiry = await prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      res.status(404).json({ error: "Inquiry not found" });
      return;
    }
    if (inquiry.status === InquiryStatus.CLOSED) {
      res.status(409).json({ error: "This conversation is closed" });
      return;
    }

    const draft = await prisma.message.findFirst({
      where: { id: messageId, inquiryId: id, sender: MessageSender.AI_DRAFT },
    });
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const updated = await prisma.message.updateMany({
      where: { id: messageId, inquiryId: id, draftStatus: DraftStatus.PENDING },
      data: { draftStatus: DraftStatus.DISCARDED },
    });
    if (updated.count === 0) {
      res.status(409).json({ error: "This draft has already been reviewed" });
      return;
    }

    await respondWithInquiryThread(res, id);
  },
);

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

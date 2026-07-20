import { randomUUID } from "node:crypto";
import { Router } from "express";
import { InquiryChannel, InquiryStatus, MessageSender } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { addMessageSchema, createInquirySchema } from "@es-market/core";

// Public inquiry endpoints; mounted at /api in index.ts.
export const inquiriesRouter = Router();

inquiriesRouter.post("/storefront/inquiries", async (req, res) => {
  const parsed = createInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { customerName, customerEmail, customerPhone, message } = parsed.data;

  const inquiry = await prisma.inquiry.create({
    data: {
      id: randomUUID(),
      channel: InquiryChannel.WEBSITE,
      customerName,
      customerEmail,
      customerPhone: customerPhone ?? null,
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

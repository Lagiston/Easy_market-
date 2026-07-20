import { randomUUID } from "node:crypto";
import { Router } from "express";
import { InquiryChannel, MessageSender } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { createInquirySchema } from "@es-market/core";

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

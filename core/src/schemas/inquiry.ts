import { z } from "zod";
import { sanitizeText } from "../sanitize";
import { LANGUAGES } from "./localized";

// Mirrors the `InquiryChannel` enum in server/prisma/schema.prisma. Shared here so
// the client (which has no access to the Prisma-generated enum) and server both
// reference the same values instead of raw string literals. Starts with a single
// value (website contact form); WhatsApp/Instagram channels will be added as
// additional enum values in a later, additive migration.
export const InquiryChannel = {
  WEBSITE: "WEBSITE",
} as const;

export type InquiryChannel = (typeof InquiryChannel)[keyof typeof InquiryChannel];

export const INQUIRY_CHANNELS = [InquiryChannel.WEBSITE] as const;

// Mirrors the `InquiryStatus` Prisma enum.
export const InquiryStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;

export type InquiryStatus = (typeof InquiryStatus)[keyof typeof InquiryStatus];

export const INQUIRY_STATUSES = [
  InquiryStatus.OPEN,
  InquiryStatus.RESOLVED,
  InquiryStatus.CLOSED,
] as const;

// Mirrors the `MessageSender` Prisma enum.
export const MessageSender = {
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
  AI_DRAFT: "AI_DRAFT",
} as const;

export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

export const MESSAGE_SENDERS = [
  MessageSender.CUSTOMER,
  MessageSender.STAFF,
  MessageSender.AI_DRAFT,
] as const;

// Mirrors the `DraftStatus` Prisma enum. Meaningful only on AI_DRAFT messages.
export const DraftStatus = {
  PENDING: "PENDING",
  SENT_UNEDITED: "SENT_UNEDITED",
  SENT_EDITED: "SENT_EDITED",
  DISCARDED: "DISCARDED",
  // Set when attemptAutoResolve (server/src/lib/inquiry-auto-resolve.ts) sends
  // a reply automatically from knowledge-base.md, with no staff review.
  AUTO_RESOLVED: "AUTO_RESOLVED",
} as const;

export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus];

export const DRAFT_STATUSES = [
  DraftStatus.PENDING,
  DraftStatus.SENT_UNEDITED,
  DraftStatus.SENT_EDITED,
  DraftStatus.DISCARDED,
  DraftStatus.AUTO_RESOLVED,
] as const;

export const CUSTOMER_NAME_ERROR = "Name must be at least 2 characters";
export const EMAIL_ERROR = "A valid email is required";
export const PHONE_ERROR = "A valid phone number is required";
export const MESSAGE_ERROR = "Message must be at least 10 characters";
export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_MAX_ERROR = `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer`;

// Contact/support form on the storefront → creates an Inquiry plus its first
// (CUSTOMER-sent) Message. Channel isn't a form field — the route always
// creates these as InquiryChannel.WEBSITE.
export const createInquirySchema = z.object({
  customerName: z
    .string(CUSTOMER_NAME_ERROR)
    .trim()
    .min(2, CUSTOMER_NAME_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 2, CUSTOMER_NAME_ERROR),
  customerEmail: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
  customerPhone: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,17}$/, PHONE_ERROR)
      .optional(),
  ),
  message: z
    .string(MESSAGE_ERROR)
    .trim()
    .min(10, MESSAGE_ERROR)
    .max(MESSAGE_MAX_LENGTH, MESSAGE_MAX_ERROR)
    .transform(sanitizeText)
    .refine((value) => value.length >= 10, MESSAGE_ERROR),
  // The customer's UI language at submission time — defaulted (not required)
  // so the route stays robust against an old/cached client build that omits it.
  language: z.enum(LANGUAGES).default("en"),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

// Pre-transform shape (what the form fields hold before name/message are normalized).
export type CreateInquiryFormInput = z.input<typeof createInquirySchema>;

export const LOOKUP_CODE_ERROR = "Inquiry code is required";

// Guest status lookup: inquiry code + the email the inquiry was submitted
// with (non-enumerable — both must match), mirroring order.ts's
// orderLookupSchema (code + phone).
export const inquiryLookupSchema = z.object({
  code: z
    .string(LOOKUP_CODE_ERROR)
    .trim()
    .min(1, LOOKUP_CODE_ERROR)
    .transform((value) => value.toUpperCase()),
  email: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
});

export type InquiryLookupInput = z.infer<typeof inquiryLookupSchema>;

// Pre-transform shape (what the form fields hold).
export type InquiryLookupFormInput = z.input<typeof inquiryLookupSchema>;

// Follow-up customer message on an existing inquiry (chat widget reply box).
export const addMessageSchema = z.object({
  message: z
    .string(MESSAGE_ERROR)
    .trim()
    .min(10, MESSAGE_ERROR)
    .max(MESSAGE_MAX_LENGTH, MESSAGE_MAX_ERROR)
    .transform(sanitizeText)
    .refine((value) => value.length >= 10, MESSAGE_ERROR),
});

export type AddMessageInput = z.infer<typeof addMessageSchema>;
export type AddMessageFormInput = z.input<typeof addMessageSchema>;

// Staff inbox queue filter: "mine" is resolved server-side from the signed-in
// user's id — never trust a client-supplied agent id for that.
export const INQUIRY_QUEUES = ["mine", "unassigned", "all"] as const;
export type InquiryQueue = (typeof INQUIRY_QUEUES)[number];

export const inquiryListQuerySchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  queue: z.enum(INQUIRY_QUEUES).default("all"),
});

export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;

// Staff assignment — omitting/blanking agentId unassigns. Mirrors the
// assignedAgentId preprocess pattern in core/src/schemas/product.ts.
export const assignInquirySchema = z.object({
  agentId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).max(100).optional(),
  ),
});

export type AssignInquiryInput = z.infer<typeof assignInquirySchema>;
export type AssignInquiryFormInput = z.input<typeof assignInquirySchema>;

// Escalation always hands the inquiry to a specific admin — unlike
// assignInquirySchema's agentId, this one is required (never an unassign).
export const escalateInquirySchema = z.object({
  agentId: z.string().trim().min(1).max(100),
});

export type EscalateInquiryInput = z.infer<typeof escalateInquirySchema>;

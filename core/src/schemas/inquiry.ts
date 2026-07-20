import { z } from "zod";
import { sanitizeText } from "../sanitize";

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
} as const;

export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

export const MESSAGE_SENDERS = [MessageSender.CUSTOMER, MessageSender.STAFF] as const;

const CUSTOMER_NAME_ERROR = "Name must be at least 2 characters";
const EMAIL_ERROR = "A valid email is required";
const PHONE_ERROR = "A valid phone number is required";
const MESSAGE_ERROR = "Message must be at least 10 characters";
const MESSAGE_MAX_ERROR = "Message must be 2000 characters or fewer";

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
    .max(2000, MESSAGE_MAX_ERROR)
    .transform(sanitizeText)
    .refine((value) => value.length >= 10, MESSAGE_ERROR),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

// Pre-transform shape (what the form fields hold before name/message are normalized).
export type CreateInquiryFormInput = z.input<typeof createInquirySchema>;

// Mirrors the `SmsLogStatus` Prisma enum (server/prisma/schema.prisma) —
// client code has no access to the Prisma-generated enum, per this
// codebase's usual mirror-const convention (see Role/FulfillmentType).
export const SmsLogStatus = {
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type SmsLogStatus = (typeof SmsLogStatus)[keyof typeof SmsLogStatus];

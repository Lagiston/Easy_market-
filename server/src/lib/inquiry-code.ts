import { randomInt } from "node:crypto";

// Non-sequential random short inquiry codes (guest lookup is code + phone,
// non-enumerable) — same alphabet/length convention as order-code.ts.
// Alphabet omits O/0 and I/1 since codes may get read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INQUIRY_CODE_LENGTH = 8;

// A fixed "MSG" prefix (leaving 5 random characters) so an inquiry code can
// never collide with an order code's format — both are 8 characters from
// the same alphabet, and without a distinguishing marker a customer (or a
// future single-field lookup on the Track page) can't tell which kind of
// code they're holding. Codes generated before this change lack the
// prefix and remain valid — only new codes get it.
const PREFIX = "MSG";
const RANDOM_LENGTH = INQUIRY_CODE_LENGTH - PREFIX.length;

export function generateInquiryCode(): string {
  let code = PREFIX;
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

import { randomInt } from "node:crypto";

// Non-sequential random short inquiry codes (guest lookup is code + email,
// non-enumerable) — same alphabet/length convention as order-code.ts.
// Alphabet omits O/0 and I/1 since codes may get read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INQUIRY_CODE_LENGTH = 8;

export function generateInquiryCode(): string {
  let code = "";
  for (let i = 0; i < INQUIRY_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

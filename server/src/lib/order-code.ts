import { randomInt } from "node:crypto";

// Non-sequential random short order codes (Project-Scope: customer lookup is
// code + phone, non-enumerable). Alphabet omits O/0 and I/1 — codes get read
// to customers over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ORDER_CODE_LENGTH = 8;

export function generateOrderCode(): string {
  let code = "";
  for (let i = 0; i < ORDER_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

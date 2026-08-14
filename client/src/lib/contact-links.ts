// Groups a Tanzania-style phone number into "+255 713 685 233" for display —
// used by ContactPage.tsx's and SiteFooter.tsx's contact rows, both of
// which want a readable grouped format rather than the raw admin-entered
// string. Falls back to the input unchanged for anything that doesn't
// match a +255 mobile number shape, rather than mangling a
// differently-formatted number.
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("255")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (local.length !== 9) return phone;
  return `+255 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

// wa.me only accepts digits (no "+"/spaces) — derived from the same
// admin-configured contactPhone rather than a separate setting.
export function buildWhatsAppLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

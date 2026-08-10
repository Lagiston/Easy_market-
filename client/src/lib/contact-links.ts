import { Mail, MapPin, Phone } from "lucide-react";
import type { PublicStoreSettings } from "@es-market/core";

export const CONTACT_ICONS = { phone: Phone, email: Mail, address: MapPin } as const;

export type ContactLinkKey = keyof typeof CONTACT_ICONS;

export type ContactLink = {
  key: ContactLinkKey;
  href: string;
  label: string;
  external?: boolean;
};

// Builds the tel:/mailto:/Google-Maps-search links shared by ContactPage.tsx
// and SiteFooter.tsx from admin-configured Settings — each field is present
// only when set (never shown blank), same precedent both consumers already
// followed independently before this was extracted.
export function buildContactLinks(
  settings:
    | Pick<PublicStoreSettings, "contactPhone" | "contactEmail" | "contactAddress">
    | undefined,
): ContactLink[] {
  if (!settings) return [];
  const links: ContactLink[] = [];
  if (settings.contactPhone) {
    links.push({
      key: "phone",
      href: `tel:${settings.contactPhone.replace(/\s/g, "")}`,
      label: settings.contactPhone,
    });
  }
  if (settings.contactEmail) {
    links.push({
      key: "email",
      href: `mailto:${settings.contactEmail}`,
      label: settings.contactEmail,
    });
  }
  if (settings.contactAddress) {
    links.push({
      key: "address",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        settings.contactAddress,
      )}`,
      label: settings.contactAddress,
      external: true,
    });
  }
  return links;
}

// Groups a Tanzania-style phone number into "+255 713 685 233" for display —
// the footer/original contact rows show the raw admin-entered string
// verbatim (buildContactLinks above, unchanged), but ContactPage.tsx's
// redesigned rows want a readable grouped format. Falls back to the input
// unchanged for anything that doesn't match a +255 mobile number shape,
// rather than mangling a differently-formatted number.
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

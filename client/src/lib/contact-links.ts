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

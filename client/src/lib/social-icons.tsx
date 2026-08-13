// Shared social icon components + links, used by both ContactPage.tsx and
// SiteFooter.tsx. Instagram/TikTok/Facebook have no admin-configurable
// Settings backing them anywhere in this codebase yet — these are plain
// hardcoded links (confirmed with the store owner), not sourced from
// Settings like phone/email/address are. WhatsApp is the exception: its
// link is derived from the existing admin-configured contactPhone setting
// via buildWhatsAppLink, same as ContactPage's own WhatsApp CTA button.
import { buildWhatsAppLink } from "@/lib/contact-links";

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.65 15.4 3.55 14.25 3.55c-2.4 0-4.05 1.47-4.05 4.15V9.9H7.5V13h2.7v8h3.3Z" />
    </svg>
  );
}

export function TiktokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.5 3c.4 2.1 1.7 3.4 4 3.6v2.9c-1.4 0-2.8-.4-4-1.2v6.5a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.07v3a3 3 0 1 0 2.1 2.86V3h2.9Z" />
    </svg>
  );
}

export function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.79.47 3.47 1.29 4.93L2 22l5.29-1.39a9.86 9.86 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.02c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.3-1.64-.6-2.88-1.25-4.76-4.15-4.9-4.34-.14-.19-1.17-1.56-1.17-2.98 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.14.14-.29.29-.13.57.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.3 2.32 1.44.28.14.44.12.61-.07.17-.19.72-.83.91-1.11.19-.28.38-.24.64-.14.26.1 1.66.78 1.94.93.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

export type SocialLinkKey = "instagram" | "tiktok" | "facebook" | "whatsapp";

export type SocialLink = {
  key: SocialLinkKey;
  href: string;
  Icon: typeof InstagramIcon;
};

const STATIC_SOCIAL_LINKS: readonly SocialLink[] = [
  { key: "instagram", href: "https://instagram.com/halatu", Icon: InstagramIcon },
  { key: "tiktok", href: "https://tiktok.com/@halatu", Icon: TiktokIcon },
  { key: "facebook", href: "https://facebook.com/halatu", Icon: FacebookIcon },
];

// WhatsApp is appended only when a contact phone is configured — unlike the
// three static links above, there's nothing sensible to link to otherwise.
export function getSocialLinks(contactPhone?: string | null): SocialLink[] {
  return contactPhone
    ? [...STATIC_SOCIAL_LINKS, { key: "whatsapp", href: buildWhatsAppLink(contactPhone), Icon: WhatsappIcon }]
    : [...STATIC_SOCIAL_LINKS];
}

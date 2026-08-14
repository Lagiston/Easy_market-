import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { formatPhoneDisplay } from "@/lib/contact-links";
import { getSocialLinks } from "@/lib/social-icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_ITEMS } from "./SiteHeader";

// A premium, asymmetric two-column "glass card" panel, theme-aware like the
// rest of the storefront: light mode uses plain theme tokens (matching
// every other card/surface on the site), dark mode restores the exact
// dark hex/rgba gradient design from the redesign spec via `dark:`
// overrides. The decorative glow/grid layers follow the same
// reduced-transparency convention as StorefrontLayout's own ambient glows.
export default function SiteFooter() {
  const { t } = useTranslation();
  // Same query/cache key as ContactPage.tsx and CheckoutPage.tsx.
  const { data: settings, isPending } = usePublicStoreSettings();
  const socialLinks = getSocialLinks(
    settings ?? {
      socialInstagramUrl: null,
      socialTiktokUrl: null,
      socialFacebookUrl: null,
      socialWhatsappUrl: null,
      contactPhone: null,
    },
  );

  return (
    <footer className="relative overflow-hidden bg-background pt-12 pb-6 font-poppins text-foreground dark:bg-[#04070a] sm:pt-20 sm:pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-240px] left-1/2 h-[620px] w-[1200px] max-w-none -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(58,167,222,0.09),transparent_72%)] dark:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(58,167,222,0.20),transparent_72%)] reduced-transparency:hidden"
      />
      <div aria-hidden className="footer-grid pointer-events-none absolute inset-0 reduced-transparency:hidden" />

      {/* Same horizontal margins as SiteHeader's outer <header> (mx-4/md:mx-8)
          so the footer card lines up edge-to-edge with the navbar pill,
          instead of the old mx-auto max-w-[1180px] cap which fell short of
          the header's width on wide viewports. */}
      <div className="relative mx-4 rounded-[32px] bg-foreground/15 p-px shadow-lg dark:bg-[linear-gradient(160deg,rgba(120,200,240,0.38),rgba(255,255,255,0.06)_34%,rgba(255,255,255,0.03))] dark:shadow-[0_60px_120px_-60px_rgba(0,0,0,0.95)] md:mx-8">
        <div className="relative flex flex-col gap-8 overflow-hidden rounded-[31px] bg-card px-6 pt-8 pb-5 dark:bg-[linear-gradient(165deg,#0c1a24,#081118_46%,#050a0e)] sm:px-[60px] sm:pt-9 sm:pb-4">
          <div
            aria-hidden
            className="pointer-events-none absolute top-[-120px] right-[-80px] h-[320px] w-[460px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(58,167,222,0.07),transparent_72%)] dark:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(58,167,222,0.22),transparent_72%)] reduced-transparency:hidden"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-10">
            {/* Left column */}
            <div className="flex max-w-[540px] flex-col items-start gap-6">
              <Link to="/" className="flex items-center gap-3">
                {/* See SiteHeader.tsx's own comment: the simplified
                    arrow-only crop, not the full leaf+arrow mark, which
                    blurs into a squiggle at on-page display sizes. */}
                <img src="/Logo/logo-mark-small.png" alt="" aria-hidden className="h-7 w-auto shrink-0 object-contain" />
                <span className="text-[28px] font-bold tracking-[-0.03em] whitespace-nowrap text-foreground dark:text-white">
                  {t("brand")}
                </span>
              </Link>

              <p className="text-[20px] leading-[1.5] tracking-[-0.015em]">
                <span className="text-foreground dark:text-[#dceaf4]">{t("footer.missionLead")}</span>{" "}
                <span className="text-muted-foreground dark:text-[rgba(220,234,244,0.45)]">
                  {t("footer.missionRest")}
                </span>
              </p>

              <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center gap-x-[30px] gap-y-3">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="border-b border-transparent pb-1 text-[16px] font-medium text-foreground/70 transition-all duration-[180ms] hover:border-[#4fb8ee] hover:text-foreground dark:text-[rgba(232,242,250,0.72)] dark:hover:text-white"
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right column */}
            <div className="flex min-w-[320px] flex-col gap-3">
              <span className="font-jetbrains-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase dark:text-[rgba(180,208,226,0.45)]">
                {t("footer.getInTouch")}
              </span>

              {isPending ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-[58px] w-full rounded-2xl dark:bg-white/5" />
                  <Skeleton className="h-[58px] w-full rounded-2xl dark:bg-white/5" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {settings?.contactPhone && (
                    <ContactButton
                      href={`tel:${settings.contactPhone.replace(/\s/g, "")}`}
                      caption={t("footer.callCaption")}
                      value={formatPhoneDisplay(settings.contactPhone)}
                      variant="primary"
                    />
                  )}
                  {settings?.contactEmail && (
                    <ContactButton
                      href={`mailto:${settings.contactEmail}`}
                      caption={t("footer.emailCaption")}
                      value={settings.contactEmail}
                      variant="secondary"
                    />
                  )}
                </div>
              )}

              {settings?.contactAddress && (
                <p className="font-jetbrains-mono text-[12px] text-muted-foreground dark:text-[rgba(180,208,226,0.42)]">
                  {settings.contactAddress}
                </p>
              )}
            </div>
          </div>

          <div className="relative h-px w-full bg-[linear-gradient(90deg,rgba(31,131,189,0.35),rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.02))] dark:bg-[linear-gradient(90deg,rgba(79,184,238,0.35),rgba(255,255,255,0.09)_30%,rgba(255,255,255,0.03))]" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <p className="font-jetbrains-mono text-[12px] text-muted-foreground dark:text-[rgba(180,208,226,0.4)]">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
            <div className="flex items-center gap-2.5">
              {socialLinks.map(({ key, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={key}
                  className="flex size-[38px] items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] text-foreground/70 transition-all duration-[180ms] hover:-translate-y-0.5 hover:bg-[#4fb8ee] hover:text-[#04121b] dark:border-[rgba(255,255,255,0.11)] dark:bg-[rgba(255,255,255,0.03)] dark:text-[rgba(180,208,226,0.7)]"
                >
                  <Icon aria-hidden className="size-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ContactButton({
  href,
  caption,
  value,
  variant,
}: {
  href: string;
  caption: string;
  value: string;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <a
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-all duration-[180ms]",
        isPrimary
          ? "bg-gradient-to-br from-[#4fb8ee] to-[#1f83bd] text-[#04121b] shadow-[0_16px_40px_-20px_rgba(79,184,238,0.9)] hover:-translate-y-0.5"
          : "border border-foreground/10 bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.06] dark:border-[rgba(255,255,255,0.13)] dark:bg-[rgba(255,255,255,0.04)] dark:text-white dark:hover:border-[rgba(255,255,255,0.22)] dark:hover:bg-[rgba(255,255,255,0.09)]",
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className={cn("text-[11px]", isPrimary ? "text-[#04121b]/70" : "text-muted-foreground dark:text-[rgba(226,238,247,0.55)]")}>
          {caption}
        </span>
        <span className={cn("text-[18px] font-semibold", isPrimary ? "text-[#04121b]" : "text-foreground dark:text-white")}>
          {value}
        </span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </a>
  );
}

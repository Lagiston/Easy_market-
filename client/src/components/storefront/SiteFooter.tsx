import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { buildContactLinks, CONTACT_ICONS } from "@/lib/contact-links";
import { getSocialLinks } from "@/lib/social-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_ITEMS } from "./SiteHeader";

// Permanently dark, one-off "glass card" panel — unlike the rest of the
// storefront (which follows the light/dark theme toggle), this section is
// a deliberate design exception, per the redesign spec. Colors below are
// the spec's exact hex/rgba values used as Tailwind arbitrary values
// rather than theme tokens, so they don't shift with the site's theme.
export default function SiteFooter() {
  const { t } = useTranslation();
  // Same query/cache key as ContactPage.tsx and CheckoutPage.tsx.
  const { data: settings, isPending } = usePublicStoreSettings();
  const contactLinks = buildContactLinks(settings);
  const socialLinks = getSocialLinks(settings?.contactPhone);

  return (
    <footer className="bg-[radial-gradient(120%_90%_at_50%_0%,#0d1c28,#070b10_55%,#05080b)] px-6 pt-24 pb-14 font-poppins text-[#e2eef7] sm:px-12">
      <div className="mx-auto flex max-w-[1060px] flex-col items-center gap-8 rounded-[28px] border border-[rgba(255,255,255,0.09)] bg-[linear-gradient(180deg,rgba(38,120,170,0.20),rgba(10,20,28,0.55)_45%,rgba(6,11,15,0.75))] px-6 pt-14 pb-7 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-16">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="relative flex size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#3aa7de] to-[#1c7fb8]"
          >
            <span className="absolute h-[150%] w-2 -rotate-45 bg-white" />
          </span>
          <span className="text-[30px] font-bold tracking-tight whitespace-nowrap text-white">
            {t("brand")}
          </span>
        </Link>

        <p className="max-w-[620px] text-center text-[17px] leading-[1.65] text-[rgba(226,238,247,0.62)]">
          {t("footer.mission")}
        </p>

        <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[18px] font-medium text-[rgba(226,238,247,0.75)] transition-colors hover:text-white"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {isPending ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Skeleton className="h-11 w-44 rounded-full bg-white/5" />
            <Skeleton className="h-11 w-56 rounded-full bg-white/5" />
            <Skeleton className="h-11 w-64 rounded-full bg-white/5" />
          </div>
        ) : (
          contactLinks.length > 0 && (
            <address className="flex flex-wrap items-center justify-center gap-3 not-italic">
              {contactLinks.map(({ key, href, label, external }) => {
                const Icon = CONTACT_ICONS[key];
                return (
                  <a
                    key={key}
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-[15px] text-[rgba(226,238,247,0.85)] transition-colors hover:bg-[rgba(255,255,255,0.09)] hover:text-white"
                  >
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#3aa7de]" />
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {label}
                  </a>
                );
              })}
            </address>
          )
        )}

        <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />

        <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-[15px] text-white/50">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-3">
            {socialLinks.map(({ key, href, Icon }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={key}
                className="flex size-[38px] items-center justify-center rounded-full border border-current text-[rgba(226,238,247,0.75)] transition-colors hover:bg-[#3aa7de] hover:text-[#05080b]"
              >
                <Icon aria-hidden className="size-4.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

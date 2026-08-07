import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { buildContactLinks, CONTACT_ICONS } from "@/lib/contact-links";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_ITEMS } from "./SiteHeader";

export default function SiteFooter() {
  const { t } = useTranslation();
  // Same query/cache key as ContactPage.tsx and CheckoutPage.tsx.
  const { data: settings, isPending } = usePublicStoreSettings();
  const contactLinks = buildContactLinks(settings);

  return (
    <footer className="border-t bg-background px-8 py-12 text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary"
          >
            <span className="absolute h-[150%] w-1.5 -rotate-45 bg-primary-foreground" />
          </span>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap text-foreground">
            {t("brand")}
          </span>
        </Link>

        <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center justify-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[15px] transition-colors hover:text-foreground"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {isPending ? (
          <div className="flex flex-col items-center gap-2 md:items-end">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          contactLinks.length > 0 && (
            <address className="flex max-w-64 flex-col items-center gap-2 text-sm not-italic md:items-end">
              {contactLinks.map(({ key, href, label, external }) => {
                const Icon = CONTACT_ICONS[key];
                return (
                  <a
                    key={key}
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-start gap-2 text-center transition-colors hover:text-foreground md:text-end"
                  >
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {label}
                  </a>
                );
              })}
            </address>
          )
        )}
      </div>

      <Separator className="my-8" />

      <p className="text-center text-sm">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}

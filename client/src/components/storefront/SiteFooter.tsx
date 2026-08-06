import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { NAV_ITEMS } from "./SiteHeader";

// Deliberately a fixed dark section regardless of the site's light/dark
// theme toggle — a "closing band" look, not driven by theme tokens like
// every other surface in this codebase.
export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="bg-neutral-950 px-8 py-12 text-neutral-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row md:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
          >
            <span className="absolute h-[150%] w-1.5 -rotate-45 bg-neutral-950" />
          </span>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap text-white">
            {t("brand")}
          </span>
        </Link>

        <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center justify-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[15px] transition-colors hover:text-white"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      </div>

      <Separator className="my-8 bg-white/10" />

      <p className="text-center text-sm">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}

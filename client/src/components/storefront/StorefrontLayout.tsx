import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import ChatWidget from "./ChatWidget";

export default function StorefrontLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50"
      >
        {t("nav.skipToContent")}
      </a>
      {/* Ambient brand-tinted glows the glass surfaces above pick up */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden reduced-transparency:hidden"
      >
        <div className="absolute -top-32 -start-32 size-[24rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
        <div className="absolute top-1/3 -end-40 size-[28rem] rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
      </div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 px-6 py-8 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <ChatWidget />
    </div>
  );
}

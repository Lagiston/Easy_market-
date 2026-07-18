import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

export default function StorefrontLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-6 border-b bg-background px-6 py-3">
        <Link to="/" className="text-lg font-semibold text-primary">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("nav.home")}
          </Link>
        </nav>
        <div className="ms-auto">
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t px-6 py-4 text-sm text-muted-foreground">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}

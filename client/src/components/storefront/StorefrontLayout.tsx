import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import LanguageSwitcher from "./LanguageSwitcher";
import ChatWidget from "./ChatWidget";

export default function StorefrontLayout() {
  const { t } = useTranslation();
  const { totalQuantity } = useCart();
  const { data: session } = customerAuthClient.useSession();

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
          <Link
            to="/products"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("nav.products")}
          </Link>
          <Link
            to="/order-status"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("nav.orderStatus")}
          </Link>
          <Link
            to="/contact"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("nav.contact")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-4">
          <Link
            to="/cart"
            aria-label={t("cart.nav")}
            className="relative text-muted-foreground hover:text-foreground"
          >
            <ShoppingCart className="size-5" />
            {totalQuantity > 0 && (
              <span className="absolute -top-1.5 -end-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {totalQuantity}
              </span>
            )}
          </Link>
          <Link
            to={session ? "/account" : "/account/login"}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <User className="size-4" />
            {session ? session.user.name : t("nav.signIn")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t px-6 py-4 text-sm text-muted-foreground">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </footer>
      <ChatWidget />
    </div>
  );
}

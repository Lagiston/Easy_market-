import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { Heart, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { useWishlist } from "@/lib/wishlist";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import ChatWidget from "./ChatWidget";

export default function StorefrontLayout() {
  const { t } = useTranslation();
  const { totalQuantity } = useCart();
  const { data: session } = customerAuthClient.useSession();
  // Safe pre-session — useWishlist's query is enabled: !!session, so this
  // no-ops (empty products array) for a signed-out visitor.
  const { products: wishlistProducts } = useWishlist();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Ambient brand-tinted glows the glass surfaces above pick up */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden reduced-transparency:hidden"
      >
        <div className="absolute -top-32 -start-32 size-[24rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
        <div className="absolute top-1/3 -end-40 size-[28rem] rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
      </div>
      <header className="sticky top-0 z-40 flex items-center gap-6 border-b border-border/60 bg-background/70 px-6 py-3 backdrop-blur-xl reduced-transparency:bg-background reduced-transparency:backdrop-blur-none">
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
          {session && (
            <Link
              to="/account/wishlist"
              aria-label={t("wishlist.nav")}
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Heart className="size-5" />
              {wishlistProducts.length > 0 && (
                <span className="absolute -top-1.5 -end-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {wishlistProducts.length}
                </span>
              )}
            </Link>
          )}
          <Link
            to={session ? "/account" : "/account/login"}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <User className="size-4" />
            {session ? session.user.name : t("nav.signIn")}
          </Link>
          <ThemeToggle label={t("nav.theme")} />
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

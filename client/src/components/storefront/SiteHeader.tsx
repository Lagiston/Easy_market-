import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Heart, Menu, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { useWishlist } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

// Shared with SiteFooter.tsx so the two nav lists can't drift apart.
export const NAV_ITEMS = [
  { labelKey: "nav.home", to: "/" },
  { labelKey: "nav.products", to: "/products" },
  { labelKey: "nav.orderStatus", to: "/order-status" },
  { labelKey: "nav.inquiryStatus", to: "/inquiry-status" },
  { labelKey: "nav.contact", to: "/contact" },
];

function IconBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className="absolute -top-1.5 -end-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
    >
      {count}
    </span>
  );
}

export default function SiteHeader() {
  const { t } = useTranslation();
  const { totalQuantity } = useCart();
  const { data: session } = customerAuthClient.useSession();
  // Safe pre-session — useWishlist's query is enabled: !!session, so this
  // no-ops (empty products array) for a signed-out visitor.
  const { products: wishlistProducts } = useWishlist();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cartLabel =
    totalQuantity > 0 ? t("cart.navCount", { count: totalQuantity }) : t("cart.nav");
  const wishlistLabel =
    wishlistProducts.length > 0
      ? t("wishlist.navCount", { count: wishlistProducts.length })
      : t("wishlist.nav");

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-5 py-2 text-sm font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground",
      isActive && "bg-primary/10 text-foreground",
    );

  const mobileNavLinkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground",
      isActive && "bg-primary/10 text-foreground",
    );

  return (
    <header className="sticky top-4 z-40 mx-4 md:mx-8">
      <div
        className={cn(
          "grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-border/60 bg-background/70 px-4 backdrop-blur-xl transition-[height,box-shadow,background-color] duration-300 motion-reduce:transition-none reduced-transparency:bg-background reduced-transparency:backdrop-blur-none md:px-8 lg:grid-cols-[1fr_auto_1fr]",
          scrolled ? "h-14 bg-background/50 shadow-md md:h-16" : "h-16 md:h-20",
        )}
      >
        {/* Left — logo lockup */}
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <span
            aria-hidden
            className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary"
          >
            <span className="absolute h-[150%] w-1.5 -rotate-45 bg-primary-foreground" />
          </span>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap text-foreground">
            {t("brand")}
          </span>
        </Link>

        {/* Center — floating pill nav */}
        <nav
          aria-label={t("nav.mainNavigation")}
          className="col-start-2 hidden items-center gap-1 justify-self-center rounded-full bg-background/90 p-1.5 backdrop-blur-md reduced-transparency:bg-background reduced-transparency:backdrop-blur-none lg:flex"
        >
          {/* `end` is only set for "/" — every other nav item should stay
              highlighted on its nested routes too (e.g. /products/:id keeps
              "Products" active), which currently only matters for Products
              since it's the only item with a nested child route. */}
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClassName}>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Right zone — desktop */}
        <div className="col-start-3 hidden flex-nowrap items-center gap-3 justify-self-end lg:flex">
          <Link
            to="/cart"
            aria-label={cartLabel}
            className="relative shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ShoppingCart className="size-5" />
            <IconBadge count={totalQuantity} />
          </Link>
          {session && (
            <Link
              to="/account/wishlist"
              aria-label={wishlistLabel}
              className="relative shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Heart className="size-5" />
              <IconBadge count={wishlistProducts.length} />
            </Link>
          )}
          <Link
            to={session ? "/account" : "/account/login"}
            className="flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            <User className="size-4" />
            {session ? session.user.name : t("nav.signIn")}
          </Link>
          <ThemeToggle label={t("nav.theme")} />
          <LanguageSwitcher />
        </div>

        {/* Mobile trigger */}
        <div className="col-start-3 justify-self-end lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("nav.menu")} />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>{t("brand")}</SheetTitle>
              </SheetHeader>
              <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1 px-4">
                {NAV_ITEMS.map((item) => (
                  <SheetClose key={item.to} render={
                    <NavLink to={item.to} end={item.to === "/"} className={mobileNavLinkClassName} />
                  }>
                    {t(item.labelKey)}
                  </SheetClose>
                ))}
              </nav>
              <div className="flex flex-col gap-1 border-t px-4 pt-4">
                <SheetClose
                  render={
                    <Link
                      to="/cart"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                    />
                  }
                >
                  <span className="relative">
                    <ShoppingCart className="size-4" />
                    <IconBadge count={totalQuantity} />
                  </span>
                  {t("cart.nav")}
                </SheetClose>
                {session && (
                  <SheetClose
                    render={
                      <Link
                        to="/account/wishlist"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                      />
                    }
                  >
                    <span className="relative">
                      <Heart className="size-4" />
                      <IconBadge count={wishlistProducts.length} />
                    </span>
                    {t("wishlist.nav")}
                  </SheetClose>
                )}
                <SheetClose
                  render={
                    <Link
                      to={session ? "/account" : "/account/login"}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                    />
                  }
                >
                  <User className="size-4" />
                  {session ? session.user.name : t("nav.signIn")}
                </SheetClose>
                {/* Deliberately not wrapped in SheetClose, unlike every other
                    row above — toggling theme/language isn't a navigation,
                    so the sheet should stay open for further browsing. */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <ThemeToggle label={t("nav.theme")} />
                  <LanguageSwitcher />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

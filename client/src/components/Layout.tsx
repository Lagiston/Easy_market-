import { useState } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { Role } from "@es-market/core";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";

const ATTENTION_POLL_MS = 30000;

export default function Layout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Kept visible while the mobile menu sheet is open — its own trigger
  // button lives inside the nav, matching SiteHeader.tsx's storefront
  // equivalent.
  const hidden = useHideOnScroll(mobileOpen);

  // Inquiries still open/resolved that are unclaimed or escalated — the nav
  // badge's "needs a human to look at this" count.
  const { data: attentionCount } = useQuery({
    queryKey: ["inquiries-attention-count"],
    queryFn: () =>
      axios
        .get<{ count: number }>("/api/inquiries/attention-count")
        .then((res) => res.data.count),
    refetchInterval: ATTENTION_POLL_MS,
  });

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/admin/login", { replace: true }),
      },
    });
  }

  // Driven as data so the same list renders in both the desktop row and the
  // mobile sheet without duplicating each Link's JSX.
  const navLinks = [
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/inquiries", label: "Inquiries", badge: attentionCount },
    { to: "/admin/users", label: "Users", adminOnly: true },
    { to: "/admin/products", label: "Products", adminOnly: true },
    { to: "/admin/categories", label: "Categories", adminOnly: true },
    { to: "/admin/kb-articles", label: "Knowledge base", adminOnly: true },
    { to: "/admin/promo-blocks", label: "Promo blocks", adminOnly: true },
    { to: "/admin/reviews", label: "Reviews", adminOnly: true },
    { to: "/admin/settings", label: "Settings", adminOnly: true },
  ].filter((item) => !item.adminOnly || user.role === Role.ADMIN);

  return (
    <div className="sticky top-0 z-40 animate-[navbar-enter_0.5s_ease-out_forwards] motion-reduce:animate-none">
      <nav
        className={cn(
          "flex items-center justify-between border-b border-border/60 bg-background/70 px-6 py-3 backdrop-blur-xl transition-transform duration-300 motion-reduce:transition-none reduced-transparency:bg-background reduced-transparency:backdrop-blur-none",
          hidden ? "-translate-y-full" : "translate-y-0",
        )}
      >
        {/* Desktop */}
        <div className="hidden items-center gap-6 lg:flex">
          <Link to="/admin" className="text-lg font-semibold">
            ES-Market
          </Link>
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {item.label}
              {!!item.badge && (
                <Badge
                  variant="destructive"
                  aria-label={`${item.badge} inquiries need attention`}
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-4 lg:flex">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {/* Mobile */}
        <Link to="/admin" className="text-lg font-semibold lg:hidden">
          ES-Market
        </Link>
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>ES-Market</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {navLinks.map((item) => (
                  <SheetClose
                    key={item.to}
                    render={
                      <Link
                        to={item.to}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                      />
                    }
                  >
                    {item.label}
                    {!!item.badge && (
                      <Badge
                        variant="destructive"
                        aria-label={`${item.badge} inquiries need attention`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </SheetClose>
                ))}
              </nav>
              <div className="flex flex-col gap-3 border-t px-4 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{user.name}</span>
                  {/* Deliberately not wrapped in SheetClose — toggling theme
                      isn't a navigation, so the sheet should stay open. */}
                  <ThemeToggle />
                </div>
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                    />
                  }
                >
                  Sign out
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}

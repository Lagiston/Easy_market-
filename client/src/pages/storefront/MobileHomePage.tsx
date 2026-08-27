import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Heart, Home, Search, ShoppingBag, User } from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import WishlistButton from "@/components/storefront/WishlistButton";
import { cn } from "@/lib/utils";
import {
  ALL_CATEGORIES,
  type StorefrontCategory,
  type StorefrontProduct,
} from "./ProductsPage";

// Deliberate always-light exception (near-white/black/red), matching this
// codebase's other intentionally theme-independent surfaces — literal hex/
// arbitrary Tailwind values throughout instead of semantic tokens, so this
// screen renders identically regardless of the site's dark-mode toggle.
const TAP_CLASS = "active:scale-[0.96] transition-transform duration-[120ms] ease-out";
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function useNewestProducts() {
  return useQuery({
    queryKey: ["storefront", "products", "mobile-home", "newest"],
    queryFn: () =>
      axios
        .get<{ products: StorefrontProduct[] }>("/api/storefront/products", {
          params: { sort: "newest", page: 1 },
        })
        .then((res) => res.data.products),
  });
}

function useFilteredProducts(categoryId: string) {
  return useQuery({
    queryKey: ["storefront", "products", "mobile-home", "filtered", categoryId],
    queryFn: () =>
      axios
        .get<{ products: StorefrontProduct[] }>("/api/storefront/products", {
          params: {
            sort: "newest",
            page: 1,
            ...(categoryId !== ALL_CATEGORIES ? { categoryId } : {}),
          },
        })
        .then((res) => res.data.products),
  });
}

function HeroCard({ product, language }: { product: StorefrontProduct; language: string }) {
  const swatches = product.images.slice(0, 3);
  return (
    // `overflow-hidden` lives on the inner card (below), not this wrapper —
    // the "Details" pill deliberately overlaps the card's bottom edge via
    // translate-y-1/2, and a shared overflow-hidden ancestor would clip it.
    <div className="relative h-[200px] w-full shrink-0 snap-start pb-4">
      <div className="absolute inset-0 bottom-4 overflow-hidden rounded-[20px] bg-black">
        {product.images[0] && (
          <img
            src={product.images[0]}
            alt=""
            aria-hidden
            className="absolute inset-y-0 end-0 h-full w-1/2 object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-y-0 end-0 w-1/2"
          style={{
            background:
              "radial-gradient(60% 60% at 70% 50%, rgba(255,255,255,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex h-full w-[58%] flex-col justify-center gap-2.5 p-5">
          <h3 className="line-clamp-2 text-2xl leading-tight font-extrabold tracking-tight text-white uppercase">
            {localize(product.name, language)}
          </h3>
          <p className="line-clamp-2 text-xs font-normal text-neutral-300">
            {localize(product.category.name, language)}
          </p>
          <div className="flex gap-2">
            {(swatches.length > 0 ? swatches : [product.images[0]]).filter(Boolean).map((src, i) => (
              <div
                key={i}
                className="size-10 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/10"
              >
                <img src={src!} alt="" aria-hidden className="size-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Link
        to={`/products/${product.id}`}
        className={cn(
          "absolute bottom-0 start-5 z-10 flex h-8 items-center gap-1 rounded-full bg-white px-4 text-xs font-bold text-[#111] shadow-lg",
          TAP_CLASS,
        )}
      >
        Details ›››
      </Link>
    </div>
  );
}

function PopularCard({ product, language }: { product: StorefrontProduct; language: string }) {
  return (
    <div className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-[20px] bg-gradient-to-b from-[#ececec] to-[#f7f7f7] shadow-sm">
      <Link to={`/products/${product.id}`} className="flex flex-1 items-center justify-center p-6">
        {product.images[0] && (
          <img
            src={product.images[0]}
            alt={localize(product.name, language)}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </Link>
      <WishlistButton
        productId={product.id}
        className={cn(
          "absolute top-2 start-2 z-10 size-8 rounded-full border-0 bg-black text-white hover:bg-black hover:text-white",
          TAP_CLASS,
        )}
      />
      <div className="bg-white px-2 py-2 text-center">
        <p className="truncate text-sm font-bold text-[#111]">{localize(product.name, language)}</p>
      </div>
    </div>
  );
}

function FilteredCard({ product, language }: { product: StorefrontProduct; language: string }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className={cn(
        "relative flex aspect-[4/5] flex-col overflow-hidden rounded-[20px] bg-gradient-to-b from-[#ececec] to-[#f7f7f7] shadow-sm",
        TAP_CLASS,
      )}
    >
      <div className="flex flex-1 items-center justify-center p-6">
        {product.images[0] && (
          <img src={product.images[0]} alt="" aria-hidden className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="space-y-0.5 bg-white px-3 py-2.5">
        <p className="truncate text-sm font-bold text-[#111]">{localize(product.name, language)}</p>
        <p className="truncate text-[11px] text-neutral-500">
          {localize(product.category.name, language)}
        </p>
      </div>
    </Link>
  );
}

export default function MobileHomePage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const location = useLocation();
  const { totalQuantity } = useCart();
  const { data: session } = customerAuthClient.useSession();
  const { data: allNewest } = useNewestProducts();
  const { data: categories } = useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () =>
      axios
        .get<{ categories: StorefrontCategory[] }>("/api/storefront/categories")
        .then((res) => res.data.categories),
  });

  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const { data: filteredProducts } = useFilteredProducts(categoryId);

  const withImages = (allNewest ?? []).filter((p) => p.images.length > 0);
  const heroProducts = withImages.slice(0, 3);
  const popularProducts = withImages.slice(3, 7);

  const heroTrackRef = useRef<HTMLDivElement>(null);
  const [activeHero, setActiveHero] = useState(0);

  useEffect(() => {
    const track = heroTrackRef.current;
    if (!track) return;
    const onScroll = () => {
      const cardWidth = track.clientWidth;
      if (cardWidth === 0) return;
      const index = Math.round(track.scrollLeft / cardWidth);
      setActiveHero(Math.min(Math.max(index, 0), heroProducts.length - 1));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [heroProducts.length]);

  const tabs = [
    { icon: Home, to: "/mobile-home", label: "Home" },
    { icon: Search, to: "/products", label: "Search" },
    { icon: Heart, to: "/account/wishlist", label: "Wishlist" },
    { icon: User, to: session ? "/account" : "/account/login", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans text-[#111]">
      <header className="flex h-14 items-center justify-between px-4">
        <img src="/Logo/logo-mark-small.png" alt="Halatu" className="h-7 w-auto object-contain" />
        <Link to="/cart" aria-label="Cart" className={cn("relative", TAP_CLASS)}>
          <ShoppingBag className="size-6" />
          {totalQuantity > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -end-0.5 size-1.5 rounded-full bg-red-500"
            />
          )}
        </Link>
      </header>

      <main className="flex flex-col gap-5 px-4 pb-32">
        {/* Hero carousel */}
        {heroProducts.length > 0 && (
          <section className="flex flex-col gap-3">
            <div
              ref={heroTrackRef}
              className={cn(
                "flex snap-x snap-mandatory gap-4 overflow-x-auto pe-4",
                NO_SCROLLBAR,
              )}
            >
              {heroProducts.map((product) => (
                <HeroCard key={product.id} product={product} language={language} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {heroProducts.map((_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    "rounded-full transition-all",
                    i === activeHero ? "h-1 w-4 bg-[#111]" : "size-[5px] bg-neutral-300",
                  )}
                />
              ))}
            </div>
          </section>
        )}

        {/* New Popular Item */}
        {popularProducts.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[22px] font-bold text-[#111]">New Popular Item</h2>
              <Link to="/products" className="text-xs font-normal text-neutral-500">
                See All ›
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {popularProducts.map((product) => (
                <PopularCard key={product.id} product={product} language={language} />
              ))}
            </div>
          </section>
        )}

        {/* Category chips */}
        <div className={cn("-me-4 flex gap-2.5 overflow-x-auto pe-4", NO_SCROLLBAR)}>
          <button
            type="button"
            onClick={() => setCategoryId(ALL_CATEGORIES)}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-full px-5 text-sm font-medium",
              TAP_CLASS,
              categoryId === ALL_CATEGORIES ? "bg-[#111] text-white" : "bg-[#ececec] text-[#111]",
            )}
          >
            All
          </button>
          {(categories ?? []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full px-5 text-sm font-medium",
                TAP_CLASS,
                categoryId === category.id ? "bg-[#111] text-white" : "bg-[#ececec] text-[#111]",
              )}
            >
              {localize(category.name, language)}
            </button>
          ))}
        </div>

        {/* Filtered grid */}
        {filteredProducts?.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            No items in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(filteredProducts ?? []).map((product) => (
              <FilteredCard key={product.id} product={product} language={language} />
            ))}
          </div>
        )}
      </main>

      {/* Floating tab bar */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-10 bottom-6 z-50 flex h-16 items-center justify-evenly rounded-full bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
      >
        {tabs.map(({ icon: Icon, to, label }) => {
          const active = to === "/mobile-home" ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link key={label} to={to} aria-label={label} className={TAP_CLASS}>
              <Icon className={cn("size-6", active ? "text-[#111]" : "text-neutral-400")} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

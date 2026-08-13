import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  ImageOff,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { DEFAULT_SETTINGS } from "@es-market/core";
import { localize } from "@/lib/localize";
import { useCart, type CartItem } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { Money, formatCurrencyValue } from "@/components/Money";

const MONEY_PREFIX_CLASS = "text-[0.66em] font-semibold text-muted-foreground";
// Long enough to read and react to, short enough that the bar doesn't linger
// once its ~6s job (letting a misclick be corrected) is done.
const UNDO_TIMEOUT_MS = 6000;

type PendingChange = { item: CartItem; index: number; kind: "removed" | "saved" };

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { items, subtotal, updateQuantity, removeItem, restoreItem } = useCart();
  const { data: session } = customerAuthClient.useSession();
  const { addMutation: addToWishlist } = useWishlist();
  const { data: settings } = usePublicStoreSettings();
  const { deliveryFee: configuredFee, freeDeliveryThreshold, contactAddress } =
    settings ?? DEFAULT_SETTINGS;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const meetsThreshold = freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold;
  const deliveryFee = meetsThreshold ? 0 : configuredFee;
  const total = subtotal + deliveryFee;

  const [pending, setPending] = useState<PendingChange | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  function dropItem(item: CartItem, kind: "removed" | "saved") {
    const index = items.findIndex((existing) => existing.productId === item.productId);
    removeItem(item.productId);
    // "Save for later" only actually persists anywhere when signed in — this
    // storefront has no guest-side saved-items list (cart itself is the only
    // client-only/localStorage collection). For a guest, the heart button is
    // functionally the same as delete (still undoable) — a known, accepted
    // gap rather than building a second guest storage mechanism for it.
    if (kind === "saved" && session) {
      addToWishlist.mutate(item.productId);
    }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPending({ item, index, kind });
    undoTimer.current = setTimeout(() => setPending(null), UNDO_TIMEOUT_MS);
  }

  function undo() {
    if (!pending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    restoreItem(pending.item, pending.index);
    setPending(null);
  }

  return (
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-background px-6 py-14 font-dm-sans text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div className="relative mx-auto max-w-[1120px] space-y-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{t("cart.title")}</h1>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {itemCount} {t("products.itemCount", { count: itemCount })}
            </span>
          )}
        </div>

        {pending && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-card/50 px-4 py-3 text-sm">
            <p className="min-w-0 truncate text-foreground">
              {t(pending.kind === "saved" ? "cart.savedBar" : "cart.removedBar", {
                name: localize(pending.item.name, language),
              })}
            </p>
            <button
              type="button"
              onClick={undo}
              className="shrink-0 font-semibold text-sky-700 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
            >
              {t("cart.undo")}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mx-auto max-w-md space-y-4 rounded-[20px] border border-dashed border-foreground/15 p-10 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-card/50">
              <ShoppingCart aria-hidden className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">{t("cart.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("cart.emptySubtitle")}</p>
            </div>
            <Link
              to="/products"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[13px] bg-sky-500 px-6 font-bold text-[#06140b] hover:bg-sky-400"
            >
              {t("cart.browseProducts")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {freeDeliveryThreshold !== null &&
                (meetsThreshold ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-sky-500/[0.26] bg-sky-500/[0.07] px-4 py-3">
                    <CheckCircle2 aria-hidden className="size-4 shrink-0 text-sky-700 dark:text-sky-400" />
                    <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                      {t("cart.freeDeliveryAchieved")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-amber-500/[0.26] bg-amber-500/[0.07] px-4 py-3">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {t("cart.freeDeliveryProgress", {
                        amount: `TSh ${formatCurrencyValue(freeDeliveryThreshold - subtotal)}`,
                      })}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${Math.min(100, (subtotal / freeDeliveryThreshold) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

              <div className="space-y-3">
                {items.map((item) => {
                  const name = localize(item.name, language);
                  const lineTotal = item.price * item.quantity;
                  const lowStock = item.stock > 0 && item.stock <= 5;
                  return (
                    <div
                      key={item.productId}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-card/40 p-4 transition-colors hover:border-foreground/20"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        {/* Sanctioned theme-independent photo well (matches
                            the product grid/detail pages) so a transparent
                            PNG upload still renders consistently. */}
                        <div className="flex size-[74px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-foreground/10 bg-white">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageOff
                              aria-label={t("products.noImage")}
                              className="size-6 text-neutral-600"
                            />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <Link
                            to={`/products/${item.productId}`}
                            className="block truncate font-semibold text-foreground hover:text-sky-500"
                          >
                            {name}
                          </Link>
                          {/* Only shown when it adds information beyond the
                              title — a variant like "Roll of 15" is often
                              already baked into the product name itself. */}
                          {(item.size || item.color) &&
                            !name.includes([item.size, item.color].filter(Boolean).join(" / ")) && (
                              <p className="text-xs text-muted-foreground">
                                {[item.size, item.color].filter(Boolean).join(" / ")}
                              </p>
                            )}
                          <p className="text-[12.5px] text-muted-foreground">
                            <Money amount={item.price} prefixClassName={MONEY_PREFIX_CLASS} />{" "}
                            {t("checkout.each")}
                          </p>
                          {lowStock && (
                            <span className="inline-flex w-fit items-center rounded-full border border-amber-500/30 bg-amber-500/[0.12] px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              {t("products.lowStock", { count: item.stock })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full items-center justify-between gap-3 min-[620px]:w-auto min-[620px]:justify-end min-[620px]:gap-5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={t("cart.decrease", { name })}
                            disabled={item.quantity <= 1}
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="grid size-8 place-items-center rounded-lg border border-foreground/10 bg-card/40 text-foreground disabled:opacity-40 hover:not-disabled:bg-card/70"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={t("cart.increase", { name })}
                            disabled={item.quantity >= item.stock}
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="grid size-8 place-items-center rounded-lg border border-foreground/10 bg-card/40 text-foreground disabled:opacity-40 hover:not-disabled:bg-card/70"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>

                        <p className="w-26 shrink-0 text-end text-base font-bold tabular-nums text-foreground">
                          <Money amount={lineTotal} prefixClassName={MONEY_PREFIX_CLASS} />
                        </p>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={t("cart.saveForLater", { name })}
                            onClick={() => dropItem(item, "saved")}
                            className="grid size-[34px] place-items-center rounded-[10px] text-muted-foreground hover:bg-card/60 hover:text-pink-500"
                          >
                            <Heart className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("cart.remove", { name })}
                            onClick={() => dropItem(item, "removed")}
                            className="grid size-[34px] place-items-center rounded-[10px] text-muted-foreground hover:bg-card/60 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="sticky top-6 space-y-4">
              <div className="space-y-3 rounded-[18px] border border-foreground/10 bg-card/40 p-[22px] backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                    <span className="tabular-nums text-foreground">
                      <Money amount={subtotal} prefixClassName={MONEY_PREFIX_CLASS} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.delivery")}</span>
                    <span className="tabular-nums text-foreground">
                      {deliveryFee === 0 ? (
                        t("checkout.free")
                      ) : (
                        <Money amount={deliveryFee} prefixClassName={MONEY_PREFIX_CLASS} />
                      )}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {contactAddress
                      ? t("cart.pickupNote", { address: contactAddress })
                      : t("cart.pickupNoteFallback")}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-foreground/10 pt-3">
                  <span className="text-sm font-medium text-foreground">
                    {t("cart.estimatedTotal")}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums text-foreground">
                    <Money amount={total} prefixClassName={MONEY_PREFIX_CLASS} />
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  to="/checkout"
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] bg-sky-500 font-bold text-[#06140b] hover:bg-sky-400"
                >
                  {t("cart.checkout")}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link
                  to="/products"
                  className="flex h-11 w-full items-center justify-center rounded-[13px] text-sm font-medium text-foreground hover:bg-card/60"
                >
                  {t("cart.keepShopping")}
                </Link>
              </div>

              <div className="space-y-2.5 rounded-[18px] border border-foreground/10 bg-card/40 p-[22px]">
                <TrustLine icon={Wallet} text={t("cart.trustCash")} />
                <TrustLine icon={Truck} text={t("cart.trustDelivery")} />
                <TrustLine icon={Store} text={t("cart.trustPickup")} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function TrustLine({ icon: Icon, text }: { icon: typeof Wallet; text: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] text-foreground">
      <Icon aria-hidden className="size-4 shrink-0 text-sky-500" />
      {text}
    </p>
  );
}

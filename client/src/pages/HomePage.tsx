import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { Link } from "react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ArrowUpRight, Heart, RefreshCw, Star, TriangleAlert } from "lucide-react";
import { InquiryStatus, OrderStatus, Role } from "@es-market/core";
import { authClient } from "@/lib/auth-client";
import { useStoreSettings } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import { formatRelativeAge, getAgeSeverity, type AgeSeverity } from "@/lib/relative-time";
import type { OrderRow } from "@/components/OrdersTable";
import { canClaim, type InquiryRow } from "@/components/InquiriesTable";
import { getStockStatus, type ProductRow } from "@/components/ProductsTable";
import type { ReviewRow } from "@/components/ReviewsTable";
import SoldOutChart, { type SoldOutPoint } from "@/components/SoldOutChart";
import SoldOutProductsDialog from "./SoldOutProductsDialog";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import InquiryStatusBadge from "@/components/InquiryStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MostWishlistedProduct = { id: string; name: string; wishlistCount: number };

type DashboardStats = {
  products: number;
  orders: number;
  lowStock: number;
  openInquiries: number;
  escalatedInquiries: number;
  draftSuccessRate: number | null;
  categorySuggestionAcceptanceRate: number | null;
  tagSuggestionAcceptanceRate: number | null;
  avgFirstResponseMinutes: number | null;
  draftLittleEditRate: number | null;
  ordersThisWeek: number;
};

const ATTENTION_LIMIT = 5;
// 1-2 stars, no staff reply yet — "needs a reply", not "is unhappy" in
// general (a low rating the store already responded to isn't in this list).
const LOW_RATING_THRESHOLD = 2;

const AGE_SEVERITY_CLASS: Record<AgeSeverity, string> = {
  default: "text-muted-foreground",
  amber: "text-amber-700 dark:text-amber-500",
  red: "text-red-700 dark:text-red-500",
};

// ---------------------------------------------------------------------------
// Section header — small uppercase label + a rule filling the remaining width.
// ---------------------------------------------------------------------------
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-xs font-bold tracking-[0.13em] text-muted-foreground uppercase">
        {label}
      </h2>
      <div aria-hidden className="h-px flex-1 bg-foreground/[0.07]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card — loading skeleton, "No data yet" instead of a bare em-dash,
// optional attention tone, optional contextual note, optional link.
// ---------------------------------------------------------------------------
type Attention = "none" | "warn" | "bad";

const ATTENTION_CARD_CLASS: Record<Attention, string> = {
  none: "border-foreground/10 bg-card/50",
  warn: "border-amber-500/[0.34] bg-amber-500/[0.055]",
  bad: "border-red-500/[0.34] bg-red-500/[0.055]",
};

const ATTENTION_VALUE_CLASS: Record<Attention, string> = {
  none: "text-foreground",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

function StatCard({
  label,
  value,
  suffix = "",
  attention = "none",
  href,
  note,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
  attention?: Attention;
  href?: string;
  note?: ReactNode;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      <p className="line-clamp-2 min-h-[2.7em] text-[12.5px] text-muted-foreground">{label}</p>
      {value === undefined ? (
        <div className="mt-auto space-y-1.5">
          <Skeleton className="h-8 w-16" />
        </div>
      ) : (
        <div className="mt-auto">
          {value === null ? (
            <p className="text-[13px] font-medium text-muted-foreground">{t("admin.dashboard.noDataYet")}</p>
          ) : (
            <p
              className={cn(
                "text-3xl font-extrabold tracking-[-0.03em]",
                ATTENTION_VALUE_CLASS[attention],
              )}
            >
              {value}
              {suffix}
            </p>
          )}
          {note && <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{note}</p>}
        </div>
      )}
    </>
  );

  const cardClass = cn(
    "group relative flex min-h-[118px] flex-col rounded-[15px] border p-4 transition-transform",
    ATTENTION_CARD_CLASS[attention],
  );

  if (href) {
    return (
      <Link data-slot="stat-card" to={href} className={cn(cardClass, "hover:-translate-y-0.5")}>
        {body}
        <ArrowUpRight
          aria-hidden
          className="absolute top-3 end-3 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </Link>
    );
  }
  return (
    <div data-slot="stat-card" className={cardClass}>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel — a list-panel wrapper with title/description/"View all" header.
// ---------------------------------------------------------------------------
function Panel({
  title,
  description,
  viewAllHref,
  children,
}: {
  title: string;
  description: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[18px] border border-foreground/10 bg-card/50 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="shrink-0 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("admin.dashboard.viewAll")}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — dashed box, with an optional action for panels that have one.
// ---------------------------------------------------------------------------
function EmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-foreground/10 p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="mt-3 inline-flex h-8 items-center rounded-[9px] px-3.5 text-[12.5px] font-semibold text-foreground hover:bg-emerald-500 hover:text-[#06140b]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic list row — main column, relative age, status badge, action button.
// ---------------------------------------------------------------------------
function ListRow({
  href,
  title,
  meta,
  date,
  badge,
  action,
}: {
  href: string;
  title: string;
  meta: string;
  date?: string;
  badge?: ReactNode;
  action?: { label: string; onClick: () => void; pending?: boolean } | { label: string; href: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 hover:bg-foreground/[0.05]">
      <Link to={href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            <span>{meta}</span>
            {date && (
              <>
                {" · "}
                <span className={AGE_SEVERITY_CLASS[getAgeSeverity(date)]}>
                  {formatRelativeAge(date)}
                </span>
              </>
            )}
          </p>
        </div>
        {badge}
      </Link>
      {action &&
        ("onClick" in action ? (
          <button
            type="button"
            disabled={action.pending}
            onClick={action.onClick}
            className="h-8 shrink-0 rounded-[9px] px-3.5 text-[12.5px] font-semibold text-foreground hover:bg-emerald-500 hover:text-[#06140b] disabled:pointer-events-none disabled:opacity-50"
          >
            {action.label}
          </button>
        ) : (
          <Link
            to={action.href}
            className="h-8 shrink-0 rounded-[9px] px-3.5 text-[12.5px] font-semibold text-foreground content-center hover:bg-emerald-500 hover:text-[#06140b]"
          >
            {action.label}
          </Link>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock indicator — "N left / M" plus a progress bar filled to current/threshold.
// ---------------------------------------------------------------------------
function StockIndicator({ stock, threshold }: { stock: number; threshold: number }) {
  const { t } = useTranslation();
  const percent = threshold > 0 ? Math.min(100, (stock / threshold) * 100) : 0;
  return (
    <div className="w-24 shrink-0 text-end">
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-amber-700 dark:text-amber-400">
          {t("admin.dashboard.stockLeft", { count: stock })}
        </span>{" "}
        / {threshold}
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function oldestDate<T>(items: T[] | null | undefined, getDate: (item: T) => string): string | undefined {
  if (!items || items.length === 0) return undefined;
  return items.reduce((oldest, item) => (getDate(item) < oldest ? getDate(item) : oldest), getDate(items[0]!));
}

export default function HomePage() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.ADMIN;
  const { callAttemptsBeforeCancel } = useStoreSettings();
  const [soldOutDialogDate, setSoldOutDialogDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7d");
  const queryClient = useQueryClient();
  // Forces a re-render every 30s purely so the "Updated Xm ago" line stays
  // current without requiring any user interaction.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick((tick) => tick + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () =>
      axios
        .get<{ stats: DashboardStats }>("/api/dashboard/stats")
        .then((res) => res.data.stats),
    enabled: isAdmin,
  });
  const { data: stats } = statsQuery;

  const soldOutQuery = useQuery({
    queryKey: ["dashboard-sold-out-history"],
    queryFn: () =>
      axios
        .get<{ series: SoldOutPoint[]; trackingStartDate: string | null }>(
          "/api/dashboard/sold-out-history",
        )
        .then((res) => res.data),
    enabled: isAdmin,
  });
  const { data: soldOutHistory } = soldOutQuery;

  const wishlistedQuery = useQuery({
    queryKey: ["dashboard-most-wishlisted"],
    queryFn: () =>
      axios
        .get<{ products: MostWishlistedProduct[] }>("/api/dashboard/most-wishlisted")
        .then((res) => res.data.products),
    enabled: isAdmin,
  });
  const { data: mostWishlisted } = wishlistedQuery;

  const receivedOrdersQuery = useQuery({
    queryKey: ["orders", OrderStatus.RECEIVED],
    queryFn: () =>
      axios
        .get<{ orders: OrderRow[] }>("/api/orders", {
          params: { status: OrderStatus.RECEIVED },
        })
        .then((res) => res.data.orders),
  });
  const { data: receivedOrders } = receivedOrdersQuery;

  const openInquiriesQuery = useQuery({
    queryKey: ["inquiries", "all", InquiryStatus.OPEN],
    queryFn: () =>
      axios
        .get<{ inquiries: InquiryRow[] }>("/api/inquiries", {
          params: { status: InquiryStatus.OPEN },
        })
        .then((res) => res.data.inquiries),
  });
  const { data: openInquiries } = openInquiriesQuery;

  const myInquiriesQuery = useQuery({
    queryKey: ["inquiries", "mine", InquiryStatus.OPEN],
    queryFn: () =>
      axios
        .get<{ inquiries: InquiryRow[] }>("/api/inquiries", {
          params: { queue: "mine", status: InquiryStatus.OPEN },
        })
        .then((res) => res.data.inquiries),
  });
  const { data: myInquiries } = myInquiriesQuery;

  const productsQuery = useQuery({
    queryKey: ["products", "stock", "asc"],
    queryFn: () =>
      axios
        .get<{ products: ProductRow[] }>("/api/products", {
          params: { sortBy: "stock", sortOrder: "asc" },
        })
        .then((res) => res.data.products),
    enabled: isAdmin,
  });
  const { data: products } = productsQuery;

  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: () =>
      axios.get<{ reviews: ReviewRow[] }>("/api/reviews").then((res) => res.data.reviews),
    enabled: isAdmin,
  });
  const { data: reviews } = reviewsQuery;

  const allQueries: UseQueryResult<unknown>[] = [
    statsQuery,
    soldOutQuery,
    wishlistedQuery,
    receivedOrdersQuery,
    openInquiriesQuery,
    myInquiriesQuery,
    productsQuery,
    reviewsQuery,
  ];
  const isRefreshing = allQueries.some((q) => q.isFetching);
  const handleRefresh = () => {
    for (const query of allQueries) void query.refetch();
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const handleConfirmOrder = async (order: OrderRow) => {
    setConfirmingId(order.id);
    try {
      await axios.post(`/api/orders/${order.id}/confirm`);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? String(error.response.data.error)
          : t("admin.dashboard.confirmOrderError"),
      );
    } finally {
      setConfirmingId(null);
    }
  };
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const handleClaimInquiry = async (inquiry: InquiryRow) => {
    setClaimingId(inquiry.id);
    try {
      await axios.post(`/api/inquiries/${inquiry.id}/claim`);
      void queryClient.invalidateQueries({ queryKey: ["inquiries"] });
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? String(error.response.data.error)
          : t("admin.dashboard.claimInquiryError"),
      );
    } finally {
      setClaimingId(null);
    }
  };
  const ordersAwaitingCall = receivedOrders
    ? [...receivedOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : null;
  const ordersAwaitingCallLimited = ordersAwaitingCall?.slice(0, ATTENTION_LIMIT) ?? null;
  const unassignedInquiries = openInquiries
    ? openInquiries.filter((inquiry) => inquiry.assignedAgent === null).slice(0, ATTENTION_LIMIT)
    : null;
  const escalatedInquiriesAll = openInquiries
    ? [...openInquiries.filter((inquiry) => inquiry.escalatedAt !== null)].sort((a, b) =>
        (a.escalatedAt ?? "").localeCompare(b.escalatedAt ?? ""),
      )
    : null;
  const escalatedInquiries = escalatedInquiriesAll?.slice(0, ATTENTION_LIMIT) ?? null;
  const myOpenInquiries = myInquiries ? myInquiries.slice(0, ATTENTION_LIMIT) : null;
  const lowStockProducts = products
    ? products.filter((product) => getStockStatus(product) === "low-stock")
    : null;
  const lowStockProductsLimited = lowStockProducts?.slice(0, ATTENTION_LIMIT) ?? null;
  // GET /reviews already orders newest-first, so this re-sort (oldest first)
  // is deliberate, unlike ordersAwaitingCall above which flips the API's order.
  const unrepliedLowRatings = reviews
    ? [...reviews.filter((review) => review.rating <= LOW_RATING_THRESHOLD && review.staffReply === null)].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt),
      )
    : null;
  const unrepliedLowRatingsLimited = unrepliedLowRatings?.slice(0, ATTENTION_LIMIT) ?? null;

  const oldestOrderAge = oldestDate(ordersAwaitingCall, (o) => o.createdAt);
  const oldestOpenInquiryAge = oldestDate(openInquiries, (i) => i.createdAt);
  const oldestEscalationAge = oldestDate(escalatedInquiriesAll, (i) => i.escalatedAt!);
  const oldestReviewAge = oldestDate(unrepliedLowRatings, (r) => r.createdAt);

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-foreground">
              {t("admin.dashboard.title")}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {statsQuery.dataUpdatedAt
                ? t("admin.dashboard.updated", {
                    relative: formatRelativeAge(new Date(statsQuery.dataUpdatedAt)),
                    date: new Date(statsQuery.dataUpdatedAt).toLocaleDateString(),
                  })
                : t("admin.dashboard.loading")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(value) => value && setDateRange(value)}>
              <SelectTrigger className="h-[38px] w-44" aria-label={t("admin.dashboard.dateRangeLabel")}>
                <SelectValue>
                  {{
                    "7d": t("admin.dashboard.range7d"),
                    "30d": t("admin.dashboard.range30d"),
                    quarter: t("admin.dashboard.rangeQuarter"),
                  }[dateRange] ?? t("admin.dashboard.range7d")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t("admin.dashboard.range7d")}</SelectItem>
                <SelectItem value="30d">{t("admin.dashboard.range30d")}</SelectItem>
                <SelectItem value="quarter">{t("admin.dashboard.rangeQuarter")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-[38px]"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              {t("admin.dashboard.refresh")}
            </Button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <SectionHeader label={t("admin.dashboard.sectionNeedsAttention")} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3">
            <StatCard
              label={t("admin.dashboard.lowStockItems")}
              value={stats?.lowStock}
              attention={(stats?.lowStock ?? 0) > 0 ? "warn" : "none"}
              href="/admin/products?sortBy=stock&sortOrder=asc"
              note={
                lowStockProductsLimited && lowStockProductsLimited.length > 0
                  ? t("admin.dashboard.lowStockNoteWorst", { count: lowStockProductsLimited[0]!.stock })
                  : undefined
              }
            />
            <StatCard
              label={t("admin.dashboard.ordersAwaitingConfirmation")}
              value={receivedOrders?.length}
              attention={(receivedOrders?.length ?? 0) > 0 ? "warn" : "none"}
              href="/admin/orders?status=RECEIVED"
              note={
                oldestOrderAge
                  ? t("admin.dashboard.oldestNote", { relative: formatRelativeAge(oldestOrderAge) })
                  : undefined
              }
            />
            <StatCard
              label={t("admin.dashboard.openInquiries")}
              value={stats?.openInquiries}
              attention={(stats?.openInquiries ?? 0) > 0 ? "warn" : "none"}
              href="/admin/inquiries?status=OPEN"
              note={
                oldestOpenInquiryAge
                  ? t("admin.dashboard.oldestNote", { relative: formatRelativeAge(oldestOpenInquiryAge) })
                  : undefined
              }
            />
            <StatCard
              label={t("admin.dashboard.reviewsNeedingReply")}
              value={unrepliedLowRatings?.length}
              attention={(unrepliedLowRatings?.length ?? 0) > 0 ? "bad" : "none"}
              href="/admin/reviews"
              note={
                oldestReviewAge
                  ? t("admin.dashboard.oldestNote", { relative: formatRelativeAge(oldestReviewAge) })
                  : undefined
              }
            />
            <StatCard
              label={t("admin.dashboard.escalatedInquiries")}
              value={stats?.escalatedInquiries}
              attention={(stats?.escalatedInquiries ?? 0) > 0 ? "bad" : "none"}
              href="/admin/inquiries?status=OPEN"
              note={
                oldestEscalationAge
                  ? t("admin.dashboard.oldestNote", { relative: formatRelativeAge(oldestEscalationAge) })
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <SectionHeader label={t("admin.dashboard.sectionStore")} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3">
            <StatCard label={t("admin.dashboard.products")} value={stats?.products} />
            <StatCard label={t("admin.dashboard.ordersAllTime")} value={stats?.orders} />
            <StatCard label={t("admin.dashboard.ordersThisWeek")} value={stats?.ordersThisWeek} />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <SectionHeader label={t("admin.dashboard.sectionSupportAi")} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3">
            <StatCard
              label={t("admin.dashboard.avgFirstResponseTime")}
              value={stats?.avgFirstResponseMinutes}
              suffix={t("admin.dashboard.minSuffix")}
            />
            <StatCard
              label={t("admin.dashboard.draftSuccessRate")}
              value={stats?.draftSuccessRate}
              suffix="%"
            />
            <StatCard
              label={t("admin.dashboard.draftLittleEditRate")}
              value={stats?.draftLittleEditRate}
              suffix="%"
            />
            <StatCard
              label={t("admin.dashboard.categorySuggestionAcceptance")}
              value={stats?.categorySuggestionAcceptanceRate}
              suffix="%"
            />
            <StatCard
              label={t("admin.dashboard.tagSuggestionAcceptance")}
              value={stats?.tagSuggestionAcceptanceRate}
              suffix="%"
            />
          </div>
        </div>
      )}

      <SoldOutProductsDialog
        date={soldOutDialogDate}
        onOpenChange={(open) => !open && setSoldOutDialogDate(null)}
      />

      <div className="space-y-3">
        <SectionHeader label={t("admin.dashboard.sectionQueues")} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-3.5">
          {isAdmin && (
            <Panel
              title={t("admin.dashboard.soldOutProductsTitle")}
              description={t("admin.dashboard.soldOutProductsDescription")}
            >
              <SoldOutChart
                series={soldOutHistory?.series ?? null}
                trackingStartDate={soldOutHistory?.trackingStartDate ?? null}
                onDayClick={setSoldOutDialogDate}
              />
            </Panel>
          )}

          <Panel
            title={t("admin.dashboard.ordersAwaitingCallTitle")}
            description={t("admin.dashboard.ordersAwaitingCallDescription")}
            viewAllHref="/admin/orders?status=RECEIVED"
          >
            {ordersAwaitingCallLimited === null ? (
              <LoadingRows />
            ) : ordersAwaitingCallLimited.length === 0 ? (
              <EmptyState message={t("admin.dashboard.noOrdersWaiting")} />
            ) : (
              <div className="space-y-2">
                {ordersAwaitingCallLimited.map((order) => (
                  <ListRow
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    title={order.customerName}
                    meta={order.code}
                    date={order.createdAt}
                    badge={
                      <div className="flex shrink-0 items-center gap-2">
                        {order.callAttempts > 0 && (
                          <Badge className="border-red-500/30 bg-red-500/[0.14] text-red-700 dark:text-red-400">
                            {t("admin.dashboard.callsBadge", {
                              count: order.callAttempts,
                              max: callAttemptsBeforeCancel,
                            })}
                          </Badge>
                        )}
                        <OrderStatusBadge status={order.status} />
                      </div>
                    }
                    action={{
                      label: t("admin.dashboard.confirm"),
                      pending: confirmingId === order.id,
                      onClick: () => void handleConfirmOrder(order),
                    }}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={t("admin.dashboard.unassignedInquiriesTitle")}
            description={t("admin.dashboard.unassignedInquiriesDescription")}
            viewAllHref="/admin/inquiries?queue=unassigned&status=OPEN"
          >
            {unassignedInquiries === null ? (
              <LoadingRows />
            ) : unassignedInquiries.length === 0 ? (
              <EmptyState message={t("admin.dashboard.nothingUnassigned")} />
            ) : (
              <div className="space-y-2">
                {unassignedInquiries.map((inquiry) => (
                  <ListRow
                    key={inquiry.id}
                    href={`/admin/inquiries/${inquiry.id}`}
                    title={inquiry.customerName}
                    meta={t("admin.dashboard.unassignedMeta")}
                    date={inquiry.createdAt}
                    badge={<InquiryStatusBadge status={inquiry.status} />}
                    action={
                      canClaim(inquiry)
                        ? {
                            label: t("admin.dashboard.claim"),
                            pending: claimingId === inquiry.id,
                            onClick: () => void handleClaimInquiry(inquiry),
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={t("admin.dashboard.escalatedInquiriesTitle")}
            description={t("admin.dashboard.escalatedInquiriesDescription")}
            viewAllHref="/admin/inquiries?status=OPEN"
          >
            {escalatedInquiries === null ? (
              <LoadingRows />
            ) : escalatedInquiries.length === 0 ? (
              <EmptyState message={t("admin.dashboard.nothingEscalated")} />
            ) : (
              <div className="space-y-2">
                {escalatedInquiries.map((inquiry) => (
                  <ListRow
                    key={inquiry.id}
                    href={`/admin/inquiries/${inquiry.id}`}
                    title={inquiry.customerName}
                    meta={
                      inquiry.assignedAgent
                        ? t("admin.dashboard.assignedToMeta", { name: inquiry.assignedAgent.name })
                        : t("admin.dashboard.unassignedMeta")
                    }
                    date={inquiry.escalatedAt ?? inquiry.createdAt}
                    badge={
                      <div className="flex shrink-0 items-center gap-2">
                        <TriangleAlert aria-hidden className="size-4 text-red-600 dark:text-red-400" />
                        <InquiryStatusBadge status={inquiry.status} />
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={t("admin.dashboard.myQueueTitle")}
            description={t("admin.dashboard.myQueueDescription")}
            viewAllHref="/admin/inquiries?queue=mine&status=OPEN"
          >
            {myOpenInquiries === null ? (
              <LoadingRows />
            ) : myOpenInquiries.length === 0 ? (
              <EmptyState
                message={t("admin.dashboard.nothingInQueue")}
                actionLabel={t("admin.dashboard.claimUnassigned")}
                actionHref="/admin/inquiries?queue=unassigned&status=OPEN"
              />
            ) : (
              <div className="space-y-2">
                {myOpenInquiries.map((inquiry) => (
                  <ListRow
                    key={inquiry.id}
                    href={`/admin/inquiries/${inquiry.id}`}
                    title={inquiry.customerName}
                    meta={t("admin.dashboard.assignedToYouMeta")}
                    date={inquiry.createdAt}
                    badge={<InquiryStatusBadge status={inquiry.status} />}
                  />
                ))}
              </div>
            )}
          </Panel>

          {isAdmin && (
            <Panel
              title={t("admin.dashboard.lowStockProductsTitle")}
              description={t("admin.dashboard.lowStockProductsDescription")}
              viewAllHref="/admin/products?sortBy=stock&sortOrder=asc"
            >
              {lowStockProductsLimited === null ? (
                <LoadingRows />
              ) : lowStockProductsLimited.length === 0 ? (
                <EmptyState message={t("admin.dashboard.nothingLowOnStock")} />
              ) : (
                <div className="space-y-2">
                  {lowStockProductsLimited.map((product) => (
                    <ListRow
                      key={product.id}
                      href={`/admin/products/${product.id}`}
                      title={product.name.en}
                      meta={product.category.name.en}
                      badge={
                        <StockIndicator stock={product.stock} threshold={product.lowStockThreshold} />
                      }
                      action={{
                        label: t("admin.dashboard.restock"),
                        href: `/admin/products/${product.id}`,
                      }}
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {isAdmin && (
            <Panel
              title={t("admin.dashboard.lowRatedReviewsTitle")}
              description={t("admin.dashboard.lowRatedReviewsDescription")}
              viewAllHref="/admin/reviews"
            >
              {unrepliedLowRatingsLimited === null ? (
                <LoadingRows />
              ) : unrepliedLowRatingsLimited.length === 0 ? (
                <EmptyState message={t("admin.dashboard.nothingNeedsReply")} />
              ) : (
                <div className="space-y-2">
                  {unrepliedLowRatingsLimited.map((review) => (
                    <ListRow
                      key={review.id}
                      href="/admin/reviews"
                      title={review.product.name.en}
                      meta={t("admin.dashboard.byAuthorMeta", { name: review.authorName })}
                      date={review.createdAt}
                      badge={
                        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                          <Star aria-hidden className="size-3.5 fill-red-500 text-red-500" />
                          {review.rating}
                        </span>
                      }
                      action={{ label: t("admin.dashboard.reply"), href: "/admin/reviews" }}
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {isAdmin && (
            <Panel
              title={t("admin.dashboard.mostWishlistedTitle")}
              description={t("admin.dashboard.mostWishlistedDescription")}
              viewAllHref="/admin/products"
            >
              {mostWishlisted === undefined ? (
                <LoadingRows />
              ) : mostWishlisted.length === 0 ? (
                <EmptyState message={t("admin.dashboard.nothingWishlisted")} />
              ) : (
                <div className="space-y-2">
                  {mostWishlisted.map((product) => (
                    <ListRow
                      key={product.id}
                      href={`/admin/products/${product.id}`}
                      title={product.name}
                      meta={t("admin.dashboard.wishlistedMeta")}
                      badge={
                        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                          <Heart aria-hidden className="size-3.5 fill-pink-500 text-pink-500" />
                          {product.wishlistCount}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

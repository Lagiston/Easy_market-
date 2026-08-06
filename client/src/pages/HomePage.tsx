import { useState, type ReactNode } from "react";
import axios from "axios";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Star, TriangleAlert } from "lucide-react";
import { InquiryStatus, OrderStatus, Role } from "@es-market/core";
import { authClient } from "@/lib/auth-client";
import { useStoreSettings } from "@/lib/settings-context";
import type { OrderRow } from "@/components/OrdersTable";
import type { InquiryRow } from "@/components/InquiriesTable";
import { getStockStatus, type ProductRow } from "@/components/ProductsTable";
import type { ReviewRow } from "@/components/ReviewsTable";
import SoldOutChart, { type SoldOutPoint } from "@/components/SoldOutChart";
import SoldOutProductsDialog from "./SoldOutProductsDialog";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import InquiryStatusBadge from "@/components/InquiryStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

function StatCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <CardDescription>{label}</CardDescription>
        {value === undefined ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">
            {value === null ? "—" : `${value}${suffix}`}
          </CardTitle>
        )}
      </CardHeader>
    </Card>
  );
}

function AttentionList<T extends { id: string }>({
  items,
  emptyLabel,
  renderItem,
}: {
  items: T[] | null;
  emptyLabel: string;
  renderItem: (item: T) => ReactNode;
}) {
  if (items === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

function InquiryRowLink({ inquiry }: { inquiry: InquiryRow }) {
  return (
    <Link
      to={`/admin/inquiries/${inquiry.id}`}
      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
    >
      <div>
        <p className="font-medium">{inquiry.customerName}</p>
        <p className="text-xs text-muted-foreground">
          {inquiry.assignedAgent ? `Assigned to ${inquiry.assignedAgent.name}` : "Unassigned"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {inquiry.escalatedAt && (
          <TriangleAlert className="size-4 text-destructive" aria-label="Escalated" />
        )}
        <InquiryStatusBadge status={inquiry.status} />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.ADMIN;
  const { callAttemptsBeforeCancel } = useStoreSettings();
  const [soldOutDialogDate, setSoldOutDialogDate] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () =>
      axios
        .get<{ stats: DashboardStats }>("/api/dashboard/stats")
        .then((res) => res.data.stats),
    enabled: isAdmin,
  });

  const { data: soldOutHistory } = useQuery({
    queryKey: ["dashboard-sold-out-history"],
    queryFn: () =>
      axios
        .get<{ series: SoldOutPoint[]; trackingStartDate: string | null }>(
          "/api/dashboard/sold-out-history",
        )
        .then((res) => res.data),
    enabled: isAdmin,
  });

  const { data: mostWishlisted } = useQuery({
    queryKey: ["dashboard-most-wishlisted"],
    queryFn: () =>
      axios
        .get<{ products: MostWishlistedProduct[] }>("/api/dashboard/most-wishlisted")
        .then((res) => res.data.products),
    enabled: isAdmin,
  });

  const { data: receivedOrders } = useQuery({
    queryKey: ["orders", OrderStatus.RECEIVED],
    queryFn: () =>
      axios
        .get<{ orders: OrderRow[] }>("/api/orders", {
          params: { status: OrderStatus.RECEIVED },
        })
        .then((res) => res.data.orders),
  });

  const { data: openInquiries } = useQuery({
    queryKey: ["inquiries", "all", InquiryStatus.OPEN],
    queryFn: () =>
      axios
        .get<{ inquiries: InquiryRow[] }>("/api/inquiries", {
          params: { status: InquiryStatus.OPEN },
        })
        .then((res) => res.data.inquiries),
  });

  const { data: myInquiries } = useQuery({
    queryKey: ["inquiries", "mine", InquiryStatus.OPEN],
    queryFn: () =>
      axios
        .get<{ inquiries: InquiryRow[] }>("/api/inquiries", {
          params: { queue: "mine", status: InquiryStatus.OPEN },
        })
        .then((res) => res.data.inquiries),
  });

  const { data: products } = useQuery({
    queryKey: ["products", "stock", "asc"],
    queryFn: () =>
      axios
        .get<{ products: ProductRow[] }>("/api/products", {
          params: { sortBy: "stock", sortOrder: "asc" },
        })
        .then((res) => res.data.products),
    enabled: isAdmin,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews"],
    queryFn: () =>
      axios.get<{ reviews: ReviewRow[] }>("/api/reviews").then((res) => res.data.reviews),
    enabled: isAdmin,
  });

  const ordersAwaitingCall = receivedOrders
    ? [...receivedOrders]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, ATTENTION_LIMIT)
    : null;
  const unassignedInquiries = openInquiries
    ? openInquiries.filter((inquiry) => inquiry.assignedAgent === null).slice(0, ATTENTION_LIMIT)
    : null;
  const escalatedInquiries = openInquiries
    ? openInquiries.filter((inquiry) => inquiry.escalatedAt !== null).slice(0, ATTENTION_LIMIT)
    : null;
  const myOpenInquiries = myInquiries ? myInquiries.slice(0, ATTENTION_LIMIT) : null;
  const lowStockProducts = products
    ? products.filter((product) => getStockStatus(product) === "low-stock").slice(0, ATTENTION_LIMIT)
    : null;
  // GET /reviews already orders newest-first, so no re-sort is needed here
  // (unlike ordersAwaitingCall below, which flips the API's default order).
  const unrepliedLowRatings = reviews
    ? reviews.filter((review) => review.rating <= LOW_RATING_THRESHOLD && review.staffReply === null)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Products" value={stats?.products} />
          <StatCard label="Orders" value={stats?.orders} />
          <StatCard label="Orders this week" value={stats?.ordersThisWeek} />
          <StatCard label="Low-stock items" value={stats?.lowStock} />
          <StatCard label="Open inquiries" value={stats?.openInquiries} />
          <StatCard label="Escalated inquiries" value={stats?.escalatedInquiries} />
          <StatCard
            label="Avg first-response time"
            value={stats?.avgFirstResponseMinutes}
            suffix=" min"
          />
          <StatCard label="Draft success rate" value={stats?.draftSuccessRate} suffix="%" />
          <StatCard
            label="Drafts sent with little/no edit"
            value={stats?.draftLittleEditRate}
            suffix="%"
          />
          <StatCard
            label="Category suggestion acceptance"
            value={stats?.categorySuggestionAcceptanceRate}
            suffix="%"
          />
          <StatCard
            label="Tag suggestion acceptance"
            value={stats?.tagSuggestionAcceptanceRate}
            suffix="%"
          />
          <StatCard
            label="Reviews needing a reply"
            value={unrepliedLowRatings?.length}
          />
        </div>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Sold-out products</CardTitle>
            <CardDescription>Products with zero stock, per day — last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <SoldOutChart
              series={soldOutHistory?.series ?? null}
              trackingStartDate={soldOutHistory?.trackingStartDate ?? null}
              onDayClick={setSoldOutDialogDate}
            />
          </CardContent>
        </Card>
      )}

      <SoldOutProductsDialog
        date={soldOutDialogDate}
        onOpenChange={(open) => !open && setSoldOutDialogDate(null)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders awaiting confirmation</CardTitle>
            <CardDescription>Received orders, oldest first — call to confirm.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionList
              items={ordersAwaitingCall}
              emptyLabel="No orders waiting on a call."
              renderItem={(order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.callAttempts > 0 && (
                      <Badge variant="destructive">
                        {order.callAttempts}/{callAttemptsBeforeCancel} calls
                      </Badge>
                    )}
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unassigned inquiries</CardTitle>
            <CardDescription>Open inquiries nobody has claimed yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionList
              items={unassignedInquiries}
              emptyLabel="Nothing unassigned."
              renderItem={(inquiry) => <InquiryRowLink key={inquiry.id} inquiry={inquiry} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escalated inquiries</CardTitle>
            <CardDescription>Flagged for admin attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionList
              items={escalatedInquiries}
              emptyLabel="Nothing escalated."
              renderItem={(inquiry) => <InquiryRowLink key={inquiry.id} inquiry={inquiry} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My queue</CardTitle>
            <CardDescription>Open inquiries assigned to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionList
              items={myOpenInquiries}
              emptyLabel="Nothing in your queue."
              renderItem={(inquiry) => <InquiryRowLink key={inquiry.id} inquiry={inquiry} />}
            />
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Low-stock products</CardTitle>
              <CardDescription>Below their restock threshold, lowest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttentionList
                items={lowStockProducts}
                emptyLabel="Nothing low on stock."
                renderItem={(product) => (
                  <Link
                    key={product.id}
                    to={`/admin/products/${product.id}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{product.name.en}</p>
                      <p className="text-xs text-muted-foreground">{product.category.name.en}</p>
                    </div>
                    <Badge variant="secondary">
                      {product.stock}/{product.lowStockThreshold}
                    </Badge>
                  </Link>
                )}
              />
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Low-rated reviews</CardTitle>
              <CardDescription>1-2 star reviews with no store response yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttentionList
                items={unrepliedLowRatings?.slice(0, ATTENTION_LIMIT) ?? null}
                emptyLabel="Nothing needs a reply."
                renderItem={(review) => (
                  <Link
                    key={review.id}
                    to="/admin/reviews"
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{review.product.name.en}</p>
                      <p className="text-xs text-muted-foreground">by {review.authorName}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Star aria-hidden className="size-3.5 fill-primary text-primary" />
                      {review.rating}
                    </span>
                  </Link>
                )}
              />
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Most wishlisted products</CardTitle>
              <CardDescription>All-time, by customer saves.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttentionList
                items={mostWishlisted ?? null}
                emptyLabel="Nothing wishlisted yet."
                renderItem={(product) => (
                  <Link
                    key={product.id}
                    to={`/admin/products/${product.id}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                  >
                    <p className="font-medium">{product.name}</p>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Heart aria-hidden className="size-3.5 fill-primary text-primary" />
                      {product.wishlistCount}
                    </span>
                  </Link>
                )}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

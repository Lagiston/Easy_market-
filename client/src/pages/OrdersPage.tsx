import { useState } from "react";
import { useSearchParams } from "react-router";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ORDER_STATUSES, type OrderStatus } from "@es-market/core";
import OrdersTable, { type OrderRow } from "@/components/OrdersTable";
import { STATUS_LABELS } from "@/components/OrderStatusBadge";
import CancelUnreachableOrderDialog from "./CancelUnreachableOrderDialog";
import CancelOrderDialog from "./CancelOrderDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function extractServerError(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && error.response?.data?.error
    ? String(error.response.data.error)
    : fallback;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  // Read-once (like the storefront's own ?tag= deep-link pattern), not
  // two-way synced — lets a dashboard KPI card land here pre-filtered
  // without every later Tabs change round-tripping through the URL.
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && (ORDER_STATUSES as readonly string[]).includes(fromUrl)
      ? (fromUrl as OrderStatus)
      : "all";
  });
  const [cancellingUnreachableOrder, setCancellingUnreachableOrder] =
    useState<OrderRow | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderRow | null>(null);

  const { data, isError } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: () =>
      axios
        .get<{ orders: OrderRow[] }>("/api/orders", {
          params: statusFilter === "all" ? {} : { status: statusFilter },
        })
        .then((res) => res.data.orders),
  });
  const orders = data ?? null;

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: ["orders"] });

  const logCallMutation = useMutation({
    mutationFn: (order: OrderRow) => axios.post(`/api/orders/${order.id}/call-attempt`),
    onSuccess: invalidateOrders,
  });
  const confirmMutation = useMutation({
    mutationFn: (order: OrderRow) => axios.post(`/api/orders/${order.id}/confirm`),
    onSuccess: invalidateOrders,
  });
  const outForDeliveryMutation = useMutation({
    mutationFn: (order: OrderRow) => axios.post(`/api/orders/${order.id}/out-for-delivery`),
    onSuccess: invalidateOrders,
  });
  const completeMutation = useMutation({
    mutationFn: (order: OrderRow) => axios.post(`/api/orders/${order.id}/complete`),
    onSuccess: invalidateOrders,
  });

  const serverError = logCallMutation.isError
    ? extractServerError(logCallMutation.error, "Could not log the call. Please try again.")
    : confirmMutation.isError
      ? extractServerError(confirmMutation.error, "Could not confirm the order. Please try again.")
      : outForDeliveryMutation.isError
        ? extractServerError(
            outForDeliveryMutation.error,
            "Could not mark the order out for delivery. Please try again.",
          )
        : completeMutation.isError
          ? extractServerError(
              completeMutation.error,
              "Could not complete the order. Please try again.",
            )
          : null;

  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>
          {orders ? `${orders.length} order${orders.length === 1 ? "" : "s"}` : "Customer orders"}
          {" — "}call the customer to confirm each received order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as OrderStatus | "all")}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {ORDER_STATUSES.map((status) => (
              <TabsTrigger key={status} value={status}>
                {STATUS_LABELS[status]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load orders. Please try again.
          </p>
        ) : (
          <>
            {serverError && <p className="mb-3 text-sm text-destructive">{serverError}</p>}
            <OrdersTable
              orders={orders}
              onLogCall={(order) => logCallMutation.mutate(order)}
              onConfirm={(order) => confirmMutation.mutate(order)}
              onCancelUnreachable={setCancellingUnreachableOrder}
              onOutForDelivery={(order) => outForDeliveryMutation.mutate(order)}
              onComplete={(order) => completeMutation.mutate(order)}
              onCancel={setCancellingOrder}
              actionsPending={
                logCallMutation.isPending ||
                confirmMutation.isPending ||
                outForDeliveryMutation.isPending ||
                completeMutation.isPending
              }
            />
          </>
        )}
        <CancelUnreachableOrderDialog
          order={cancellingUnreachableOrder}
          onOpenChange={(open) => {
            if (!open) setCancellingUnreachableOrder(null);
          }}
        />
        <CancelOrderDialog
          order={cancellingOrder}
          onOpenChange={(open) => {
            if (!open) setCancellingOrder(null);
          }}
        />
      </CardContent>
    </Card>
  );
}

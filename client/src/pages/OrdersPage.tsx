import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import OrdersTable, { type OrderRow } from "@/components/OrdersTable";
import CancelUnreachableOrderDialog from "./CancelUnreachableOrderDialog";
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
  const [cancellingOrder, setCancellingOrder] = useState<OrderRow | null>(null);

  const { data, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: () =>
      axios.get<{ orders: OrderRow[] }>("/api/orders").then((res) => res.data.orders),
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

  const serverError = logCallMutation.isError
    ? extractServerError(logCallMutation.error, "Could not log the call. Please try again.")
    : confirmMutation.isError
      ? extractServerError(confirmMutation.error, "Could not confirm the order. Please try again.")
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
              onCancelUnreachable={setCancellingOrder}
              actionsPending={logCallMutation.isPending || confirmMutation.isPending}
            />
          </>
        )}
        <CancelUnreachableOrderDialog
          order={cancellingOrder}
          onOpenChange={(open) => {
            if (!open) setCancellingOrder(null);
          }}
        />
      </CardContent>
    </Card>
  );
}

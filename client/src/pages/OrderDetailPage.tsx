import { useState } from "react";
import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CALL_ATTEMPTS_BEFORE_CANCEL, FulfillmentType, OrderStatus } from "@es-market/core";
import {
  canCancel,
  canComplete,
  canGoOutForDelivery,
  type OrderRow,
} from "@/components/OrdersTable";
import OrderStatusBadge, { CANCEL_REASON_LABELS } from "@/components/OrderStatusBadge";
import CancelOrderDialog from "./CancelOrderDialog";
import CancelUnreachableOrderDialog from "./CancelUnreachableOrderDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function extractServerError(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && error.response?.data?.error
    ? String(error.response.data.error)
    : fallback;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancellingOrder, setCancellingOrder] = useState<OrderRow | null>(null);
  const [cancellingUnreachableOrder, setCancellingUnreachableOrder] = useState<OrderRow | null>(
    null,
  );

  const { data: order, isPending, error } = useQuery({
    queryKey: ["orders", id],
    queryFn: () =>
      axios.get<{ order: OrderRow }>(`/api/orders/${id}`).then((res) => res.data.order),
  });

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: ["orders"] });

  const confirmMutation = useMutation({
    mutationFn: () => axios.post(`/api/orders/${id}/confirm`),
    onSuccess: invalidateOrders,
  });
  const logCallMutation = useMutation({
    mutationFn: () => axios.post(`/api/orders/${id}/call-attempt`),
    onSuccess: invalidateOrders,
  });
  const outForDeliveryMutation = useMutation({
    mutationFn: () => axios.post(`/api/orders/${id}/out-for-delivery`),
    onSuccess: invalidateOrders,
  });
  const completeMutation = useMutation({
    mutationFn: () => axios.post(`/api/orders/${id}/complete`),
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

  const actionsPending =
    logCallMutation.isPending ||
    confirmMutation.isPending ||
    outForDeliveryMutation.isPending ||
    completeMutation.isPending;

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to orders
      </Link>
      {isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ) : notFound ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Order not found.</p>
      ) : error || !order ? (
        <p className="py-8 text-center text-sm text-destructive">
          Could not load order. Please try again.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="font-mono">{order.code}</span>
              <OrderStatusBadge status={order.status} />
            </CardTitle>
            <CardDescription>
              Placed {new Date(order.createdAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="divide-y">
              <DetailRow label="Customer" value={order.customerName} />
              <DetailRow label="Phone" value={order.customerPhone} />
              <DetailRow
                label="Fulfillment"
                value={order.fulfillmentType === FulfillmentType.DELIVERY ? "Delivery" : "Pickup"}
              />
              {order.fulfillmentType === FulfillmentType.DELIVERY && (
                <DetailRow label="Address" value={order.address ?? "—"} />
              )}
              <DetailRow label="Call attempts" value={String(order.callAttempts)} />
              {order.cancelReason && (
                <DetailRow label="Cancel reason" value={CANCEL_REASON_LABELS[order.cancelReason]} />
              )}
              <DetailRow label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
            </dl>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Items</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-end">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productName.en}</TableCell>
                      <TableCell className="tabular-nums">{item.unitPrice}</TableCell>
                      <TableCell className="tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {item.unitPrice * item.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className="divide-y">
                <DetailRow label="Subtotal" value={String(order.subtotal)} />
                <DetailRow label="Delivery fee" value={String(order.deliveryFee)} />
                <DetailRow label="Total" value={String(order.total)} />
              </dl>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex flex-wrap gap-2">
              {order.status === OrderStatus.RECEIVED && (
                <>
                  <Button
                    variant="outline"
                    disabled={actionsPending}
                    onClick={() => logCallMutation.mutate()}
                  >
                    Log failed call
                  </Button>
                  <Button disabled={actionsPending} onClick={() => confirmMutation.mutate()}>
                    Confirm order
                  </Button>
                  {order.callAttempts >= CALL_ATTEMPTS_BEFORE_CANCEL && (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={actionsPending}
                      onClick={() => setCancellingUnreachableOrder(order)}
                    >
                      Cancel unreachable order
                    </Button>
                  )}
                </>
              )}
              {canGoOutForDelivery(order) && (
                <Button disabled={actionsPending} onClick={() => outForDeliveryMutation.mutate()}>
                  Mark out for delivery
                </Button>
              )}
              {canComplete(order) && (
                <Button disabled={actionsPending} onClick={() => completeMutation.mutate()}>
                  Complete order
                </Button>
              )}
              {canCancel(order) && (
                <Button
                  variant="destructive"
                  disabled={actionsPending}
                  onClick={() => setCancellingOrder(order)}
                >
                  Cancel order
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <CancelOrderDialog
        order={cancellingOrder}
        onOpenChange={(open) => {
          if (!open) setCancellingOrder(null);
        }}
      />
      <CancelUnreachableOrderDialog
        order={cancellingUnreachableOrder}
        onOpenChange={(open) => {
          if (!open) setCancellingUnreachableOrder(null);
        }}
      />
    </div>
  );
}

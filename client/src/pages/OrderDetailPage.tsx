import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { FulfillmentType, OrderStatus } from "@es-market/core";
import {
  canCancel,
  canComplete,
  canGoOutForDelivery,
  type OrderRow,
} from "@/components/OrdersTable";
import { useStoreSettings } from "@/lib/settings-context";
import OrderStatusBadge, { getCancelReasonLabel } from "@/components/OrderStatusBadge";
import SmsLogList from "@/components/SmsLogList";
import { Money } from "@/components/Money";
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { callAttemptsBeforeCancel } = useStoreSettings();
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
  // No invalidateOrders — this route never changes Order.status, so there's
  // nothing on the order itself to refetch, unlike the 4 status-transition
  // mutations above.
  const notifyDelayedMutation = useMutation({
    mutationFn: () => axios.post<{ sent: boolean }>(`/api/orders/${id}/notify-delayed`),
  });

  const serverError = logCallMutation.isError
    ? extractServerError(logCallMutation.error, t("admin.orders.logCallError"))
    : confirmMutation.isError
      ? extractServerError(confirmMutation.error, t("admin.orders.confirmError"))
      : outForDeliveryMutation.isError
        ? extractServerError(outForDeliveryMutation.error, t("admin.orders.outForDeliveryError"))
        : completeMutation.isError
          ? extractServerError(completeMutation.error, t("admin.orders.completeError"))
          : notifyDelayedMutation.isError
            ? extractServerError(
                notifyDelayedMutation.error,
                t("admin.orders.detail.notifyDelayedError"),
              )
            : null;

  const actionsPending =
    logCallMutation.isPending ||
    confirmMutation.isPending ||
    outForDeliveryMutation.isPending ||
    notifyDelayedMutation.isPending ||
    completeMutation.isPending;

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("admin.orders.detail.backToOrders")}
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("admin.orders.detail.notFound")}
        </p>
      ) : error || !order ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.orders.loadError")}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="font-mono">{order.code}</span>
              <OrderStatusBadge status={order.status} />
            </CardTitle>
            <CardDescription>
              {t("admin.orders.detail.placedOn", { date: new Date(order.createdAt).toLocaleString() })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="divide-y">
              <DetailRow label={t("admin.orders.detail.name")} value={order.customerName} />
              <DetailRow label={t("admin.orders.detail.phone")} value={order.customerPhone} />
              <DetailRow
                label={t("admin.orders.detail.fulfillment")}
                value={
                  order.fulfillmentType === FulfillmentType.DELIVERY
                    ? t("admin.orders.table.delivery")
                    : t("admin.orders.table.pickup")
                }
              />
              {order.fulfillmentType === FulfillmentType.DELIVERY && (
                <DetailRow
                  label={t("admin.orders.detail.address")}
                  value={order.address ?? t("admin.orders.detail.notFoundValue")}
                />
              )}
              <DetailRow label={t("admin.orders.detail.callAttempts")} value={String(order.callAttempts)} />
              {order.cancelReason && (
                <DetailRow
                  label={t("admin.orders.detail.cancelReason")}
                  value={getCancelReasonLabel(t, order.cancelReason)}
                />
              )}
              <DetailRow
                label={t("admin.orders.detail.updated")}
                value={new Date(order.updatedAt).toLocaleString()}
              />
            </dl>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t("admin.orders.detail.items")}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.orders.detail.product")}</TableHead>
                    <TableHead>{t("admin.orders.detail.unitPrice")}</TableHead>
                    <TableHead>{t("admin.orders.detail.quantity")}</TableHead>
                    <TableHead className="text-end">{t("admin.orders.detail.lineTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productName.en}</TableCell>
                      <TableCell className="tabular-nums">
                        <Money amount={item.unitPrice} />
                      </TableCell>
                      <TableCell className="tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        <Money amount={item.unitPrice * item.quantity} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className="divide-y">
                <DetailRow
                  label={t("admin.orders.detail.subtotal")}
                  value={<Money amount={order.subtotal} />}
                />
                <DetailRow
                  label={t("admin.orders.detail.deliveryFee")}
                  value={<Money amount={order.deliveryFee} />}
                />
                <DetailRow label={t("admin.orders.detail.total")} value={<Money amount={order.total} />} />
              </dl>
            </div>
            {order.smsLogs && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("admin.orders.detail.smsLog")}</h3>
                <SmsLogList logs={order.smsLogs} />
              </div>
            )}
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {notifyDelayedMutation.isSuccess && (
              <p className="text-sm text-muted-foreground">
                {t("admin.orders.detail.notifyDelayedSuccess")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {order.status === OrderStatus.RECEIVED && (
                <>
                  <Button
                    variant="outline"
                    disabled={actionsPending}
                    onClick={() => logCallMutation.mutate()}
                  >
                    {t("admin.orders.detail.logCall")}
                  </Button>
                  <Button disabled={actionsPending} onClick={() => confirmMutation.mutate()}>
                    {t("admin.orders.detail.confirm")}
                  </Button>
                  {order.callAttempts >= callAttemptsBeforeCancel && (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={actionsPending}
                      onClick={() => setCancellingUnreachableOrder(order)}
                    >
                      {t("admin.orders.detail.cancelUnreachable")}
                    </Button>
                  )}
                </>
              )}
              {canGoOutForDelivery(order) && (
                <Button disabled={actionsPending} onClick={() => outForDeliveryMutation.mutate()}>
                  {t("admin.orders.detail.outForDelivery")}
                </Button>
              )}
              {canComplete(order) && (
                <Button disabled={actionsPending} onClick={() => completeMutation.mutate()}>
                  {t("admin.orders.detail.complete")}
                </Button>
              )}
              {(order.status === OrderStatus.CONFIRMED ||
                order.status === OrderStatus.OUT_FOR_DELIVERY) && (
                <Button
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => notifyDelayedMutation.mutate()}
                >
                  {notifyDelayedMutation.isPending
                    ? t("admin.orders.detail.notifyingDelayed")
                    : t("admin.orders.detail.notifyDelayed")}
                </Button>
              )}
              {canCancel(order) && (
                <Button
                  variant="destructive"
                  disabled={actionsPending}
                  onClick={() => setCancellingOrder(order)}
                >
                  {t("admin.orders.detail.cancel")}
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

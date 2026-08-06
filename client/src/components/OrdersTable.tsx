import { Link } from "react-router";
import { Ban, PackageCheck, PhoneCall, PhoneMissed, PhoneOff, Truck } from "lucide-react";
import {
  FulfillmentType,
  OrderStatus,
  type CancelReason,
  type LocalizedName,
} from "@es-market/core";
import { useStoreSettings } from "@/lib/settings-context";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  address: string | null;
  deliveryFee: number;
  cancelReason: CancelReason | null;
  callAttempts: number;
  createdAt: string;
  updatedAt: string;
  subtotal: number;
  total: number;
  items: { id: string; productName: LocalizedName; unitPrice: number; quantity: number }[];
};

export function canGoOutForDelivery(order: OrderRow) {
  return (
    order.status === OrderStatus.CONFIRMED &&
    order.fulfillmentType === FulfillmentType.DELIVERY
  );
}

export function canComplete(order: OrderRow) {
  return order.fulfillmentType === FulfillmentType.DELIVERY
    ? order.status === OrderStatus.OUT_FOR_DELIVERY
    : order.status === OrderStatus.CONFIRMED;
}

export function canCancel(order: OrderRow) {
  return order.status === OrderStatus.RECEIVED || order.status === OrderStatus.CONFIRMED;
}

export default function OrdersTable({
  orders,
  onLogCall,
  onConfirm,
  onCancelUnreachable,
  onOutForDelivery,
  onComplete,
  onCancel,
  actionsPending,
}: {
  orders: OrderRow[] | null;
  onLogCall: (order: OrderRow) => void;
  onConfirm: (order: OrderRow) => void;
  onCancelUnreachable: (order: OrderRow) => void;
  onOutForDelivery: (order: OrderRow) => void;
  onComplete: (order: OrderRow) => void;
  onCancel: (order: OrderRow) => void;
  actionsPending: boolean;
}) {
  const { callAttemptsBeforeCancel } = useStoreSettings();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Calls</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Placed</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders === null ? (
          Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }, (_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-3 w-16" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : orders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
              No orders yet.
            </TableCell>
          </TableRow>
        ) : (
          orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="font-mono font-medium hover:underline"
                >
                  {order.code}
                </Link>
              </TableCell>
              <TableCell>
                <div>{order.customerName}</div>
                <div className="text-muted-foreground">{order.customerPhone}</div>
              </TableCell>
              <TableCell>
                {order.fulfillmentType === FulfillmentType.DELIVERY ? "Delivery" : "Pickup"}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="tabular-nums">{order.callAttempts}</TableCell>
              <TableCell className="tabular-nums">{order.total}</TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {order.status === OrderStatus.RECEIVED && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Log failed call for ${order.code}`}
                        disabled={actionsPending}
                        onClick={() => onLogCall(order)}
                      >
                        <PhoneMissed />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Confirm order ${order.code}`}
                        disabled={actionsPending}
                        onClick={() => onConfirm(order)}
                      >
                        <PhoneCall />
                      </Button>
                      {order.callAttempts >= callAttemptsBeforeCancel && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label={`Cancel unreachable order ${order.code}`}
                          disabled={actionsPending}
                          onClick={() => onCancelUnreachable(order)}
                        >
                          <PhoneOff />
                        </Button>
                      )}
                    </>
                  )}
                  {canGoOutForDelivery(order) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Mark order ${order.code} out for delivery`}
                      disabled={actionsPending}
                      onClick={() => onOutForDelivery(order)}
                    >
                      <Truck />
                    </Button>
                  )}
                  {canComplete(order) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Complete order ${order.code}`}
                      disabled={actionsPending}
                      onClick={() => onComplete(order)}
                    >
                      <PackageCheck />
                    </Button>
                  )}
                  {canCancel(order) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={`Cancel order ${order.code}`}
                      disabled={actionsPending}
                      onClick={() => onCancel(order)}
                    >
                      <Ban />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

import { PhoneCall, PhoneMissed, PhoneOff } from "lucide-react";
import {
  CALL_ATTEMPTS_BEFORE_CANCEL,
  OrderStatus,
  type CancelReason,
  type FulfillmentType,
  type LocalizedName,
} from "@es-market/core";
import { Badge } from "@/components/ui/badge";
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
  subtotal: number;
  total: number;
  items: { id: string; productName: LocalizedName; unitPrice: number; quantity: number }[];
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Received",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  RECEIVED: "secondary",
  CONFIRMED: "default",
  OUT_FOR_DELIVERY: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export default function OrdersTable({
  orders,
  onLogCall,
  onConfirm,
  onCancelUnreachable,
  actionsPending,
}: {
  orders: OrderRow[] | null;
  onLogCall: (order: OrderRow) => void;
  onConfirm: (order: OrderRow) => void;
  onCancelUnreachable: (order: OrderRow) => void;
  actionsPending: boolean;
}) {
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
              <TableCell className="font-mono font-medium">{order.code}</TableCell>
              <TableCell>
                <div>{order.customerName}</div>
                <div className="text-muted-foreground">{order.customerPhone}</div>
              </TableCell>
              <TableCell>
                {order.fulfillmentType === "DELIVERY" ? "Delivery" : "Pickup"}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[order.status]}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">{order.callAttempts}</TableCell>
              <TableCell className="tabular-nums">{order.total}</TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                {order.status === OrderStatus.RECEIVED && (
                  <div className="flex items-center gap-1">
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
                    {order.callAttempts >= CALL_ATTEMPTS_BEFORE_CANCEL && (
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
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

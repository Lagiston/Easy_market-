import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cancelOrderSchema, CANCEL_REASONS, type CancelOrderInput } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import { CANCEL_REASON_LABELS } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CancelOrderDialog({
  order,
  onOpenChange,
}: {
  order: OrderRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelOrderInput>({
    resolver: zodResolver(cancelOrderSchema),
  });

  const mutation = useMutation({
    mutationFn: (input: CancelOrderInput) =>
      axios.post(`/api/orders/${order!.id}/cancel`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : "Could not cancel the order. Please try again."
    : null;

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) {
          mutation.reset();
          reset();
        }
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {order?.code}?</DialogTitle>
          <DialogDescription>
            Cancelling records the reason and restores the items&apos; stock.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((input) => mutation.mutate(input))}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-order-reason">Reason</Label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? null} onValueChange={field.onChange}>
                  <SelectTrigger id="cancel-order-reason" aria-invalid={!!errors.reason}>
                    <SelectValue placeholder="Select a reason">
                      {(value: string | null) =>
                        value ? CANCEL_REASON_LABELS[value as keyof typeof CANCEL_REASON_LABELS] : ""
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {CANCEL_REASON_LABELS[reason]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter showCloseButton>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

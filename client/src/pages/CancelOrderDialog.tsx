import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { cancelOrderSchema, CANCEL_REASONS, type CancelOrderInput } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import { getCancelReasonLabel } from "@/components/OrderStatusBadge";
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
  const { t } = useTranslation();
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
      : t("admin.orders.cancelDialog.error")
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
          <DialogTitle>{t("admin.orders.cancelDialog.title", { code: order?.code })}</DialogTitle>
          <DialogDescription>{t("admin.orders.cancelDialog.description")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((input) => mutation.mutate(input))}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-order-reason">{t("admin.orders.cancelDialog.reason")}</Label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? null} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="cancel-order-reason"
                    className="w-full"
                    aria-invalid={!!errors.reason}
                  >
                    <SelectValue placeholder={t("admin.orders.cancelDialog.reasonPlaceholder")}>
                      {(value: string | null) =>
                        value ? getCancelReasonLabel(t, value as CancelOrderInput["reason"]) : ""
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {getCancelReasonLabel(t, reason)}
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
              {mutation.isPending
                ? t("admin.orders.cancelDialog.cancelling")
                : t("admin.orders.cancelDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

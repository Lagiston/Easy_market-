import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CancelReason } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CancelUnreachableOrderDialog({
  order,
  onOpenChange,
}: {
  order: OrderRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/orders/${order!.id}/cancel`, {
        reason: CancelReason.CUSTOMER_UNREACHABLE,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.orders.cancelUnreachableDialog.error")
    : null;

  return (
    <AlertDialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("admin.orders.cancelUnreachableDialog.title", { code: order?.code })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.orders.cancelUnreachableDialog.description", {
              count: order?.callAttempts,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.orders.cancelUnreachableDialog.keepOrder")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? t("admin.orders.cancelUnreachableDialog.cancelling")
              : t("admin.orders.cancelUnreachableDialog.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { deleteCustomerAccountSchema, type DeleteCustomerAccountInput } from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { translateFieldError } from "@/lib/zod-error-i18n";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Unlike every other Delete dialog in this codebase (DeleteReviewDialog.tsx,
// etc.), account deletion needs a password re-entry, so this has its own RHF
// form instead of a zero-argument mutation.mutate() on the AlertDialogAction.
export default function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DeleteCustomerAccountInput>({
    resolver: zodResolver(deleteCustomerAccountSchema),
    defaultValues: { password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: DeleteCustomerAccountInput) =>
      axios.delete("/api/customer/account", { data }),
    onSuccess: async () => {
      await customerAuthClient.signOut();
      toast.success(t("account.deleteAccount.success"));
      navigate("/");
    },
    onError: (error) => {
      const message =
        axios.isAxiosError(error) && error.response?.status === 401
          ? t("account.deleteAccount.wrongPassword")
          : t("account.deleteAccount.error");
      setError("password", { message });
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          mutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("account.deleteAccount.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("account.deleteAccount.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id="delete-account-form"
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="delete-account-password">
              {t("account.deleteAccount.passwordLabel")}
            </Label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {translateFieldError(errors.password.message, t)}
              </p>
            )}
          </div>
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            type="submit"
            form="delete-account-form"
            variant="destructive"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? t("account.deleteAccount.deleting")
              : t("account.deleteAccount.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

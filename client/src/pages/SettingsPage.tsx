import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  updateSettingsSchema,
  type StoreSettings,
  type UpdateSettingsFormInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      axios.get<{ settings: StoreSettings }>("/api/settings").then((res) => res.data.settings),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateSettingsFormInput>({
    resolver: zodResolver(updateSettingsSchema),
    values: settings
      ? {
          deliveryFee: settings.deliveryFee,
          freeDeliveryThreshold: settings.freeDeliveryThreshold ?? undefined,
          callAttemptsBeforeCancel: settings.callAttemptsBeforeCancel,
          defaultLowStockThreshold: settings.defaultLowStockThreshold,
          contactPhone: settings.contactPhone ?? undefined,
          contactEmail: settings.contactEmail ?? undefined,
          contactAddress: settings.contactAddress ?? undefined,
          socialInstagramUrl: settings.socialInstagramUrl ?? undefined,
          socialTiktokUrl: settings.socialTiktokUrl ?? undefined,
          socialFacebookUrl: settings.socialFacebookUrl ?? undefined,
          socialWhatsappUrl: settings.socialWhatsappUrl ?? undefined,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateSettingsFormInput) =>
      axios.put("/api/settings", input).then((res) => res.data.settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "settings"] });
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.settings.saveError")
    : null;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{t("admin.settings.title")}</CardTitle>
        <CardDescription>{t("admin.settings.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.settings.loadError")}
          </p>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="settings-delivery-fee">{t("admin.settings.deliveryFee")}</Label>
              <Input
                id="settings-delivery-fee"
                type="number"
                min={0}
                aria-invalid={!!errors.deliveryFee}
                {...register("deliveryFee", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.deliveryFeeHint")}</p>
              {errors.deliveryFee && (
                <p className="text-sm text-destructive">{errors.deliveryFee.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-free-threshold">
                {t("admin.settings.freeDeliveryThreshold")}
              </Label>
              <Input
                id="settings-free-threshold"
                type="number"
                min={0}
                aria-invalid={!!errors.freeDeliveryThreshold}
                {...register("freeDeliveryThreshold", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.settings.freeDeliveryThresholdHint")}
              </p>
              {errors.freeDeliveryThreshold && (
                <p className="text-sm text-destructive">
                  {errors.freeDeliveryThreshold.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-call-attempts">
                {t("admin.settings.callAttemptsBeforeCancel")}
              </Label>
              <Input
                id="settings-call-attempts"
                type="number"
                min={1}
                aria-invalid={!!errors.callAttemptsBeforeCancel}
                {...register("callAttemptsBeforeCancel", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.settings.callAttemptsBeforeCancelHint")}
              </p>
              {errors.callAttemptsBeforeCancel && (
                <p className="text-sm text-destructive">
                  {errors.callAttemptsBeforeCancel.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-default-low-stock">
                {t("admin.settings.defaultLowStockThreshold")}
              </Label>
              <Input
                id="settings-default-low-stock"
                type="number"
                min={0}
                aria-invalid={!!errors.defaultLowStockThreshold}
                {...register("defaultLowStockThreshold", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.settings.defaultLowStockThresholdHint")}
              </p>
              {errors.defaultLowStockThreshold && (
                <p className="text-sm text-destructive">
                  {errors.defaultLowStockThreshold.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-phone">{t("admin.settings.contactPhone")}</Label>
              <Input
                id="settings-contact-phone"
                type="tel"
                aria-invalid={!!errors.contactPhone}
                {...register("contactPhone")}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.contactPhoneHint")}</p>
              {errors.contactPhone && (
                <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-email">{t("admin.settings.contactEmail")}</Label>
              <Input
                id="settings-contact-email"
                type="email"
                aria-invalid={!!errors.contactEmail}
                {...register("contactEmail")}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.contactEmailHint")}</p>
              {errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-address">{t("admin.settings.contactAddress")}</Label>
              <Input
                id="settings-contact-address"
                aria-invalid={!!errors.contactAddress}
                {...register("contactAddress")}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.settings.contactAddressHint")}
              </p>
              {errors.contactAddress && (
                <p className="text-sm text-destructive">{errors.contactAddress.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-social-instagram">{t("admin.settings.socialInstagram")}</Label>
              <Input
                id="settings-social-instagram"
                type="url"
                placeholder="https://instagram.com/yourstore"
                aria-invalid={!!errors.socialInstagramUrl}
                {...register("socialInstagramUrl")}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.socialHint")}</p>
              {errors.socialInstagramUrl && (
                <p className="text-sm text-destructive">{errors.socialInstagramUrl.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-social-tiktok">{t("admin.settings.socialTiktok")}</Label>
              <Input
                id="settings-social-tiktok"
                type="url"
                placeholder="https://tiktok.com/@yourstore"
                aria-invalid={!!errors.socialTiktokUrl}
                {...register("socialTiktokUrl")}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.socialHint")}</p>
              {errors.socialTiktokUrl && (
                <p className="text-sm text-destructive">{errors.socialTiktokUrl.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-social-facebook">{t("admin.settings.socialFacebook")}</Label>
              <Input
                id="settings-social-facebook"
                type="url"
                placeholder="https://facebook.com/yourstore"
                aria-invalid={!!errors.socialFacebookUrl}
                {...register("socialFacebookUrl")}
              />
              <p className="text-sm text-muted-foreground">{t("admin.settings.socialHint")}</p>
              {errors.socialFacebookUrl && (
                <p className="text-sm text-destructive">{errors.socialFacebookUrl.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-social-whatsapp">{t("admin.settings.socialWhatsapp")}</Label>
              <Input
                id="settings-social-whatsapp"
                type="url"
                placeholder="https://wa.me/255700123456"
                aria-invalid={!!errors.socialWhatsappUrl}
                {...register("socialWhatsappUrl")}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.settings.socialWhatsappHint")}
              </p>
              {errors.socialWhatsappUrl && (
                <p className="text-sm text-destructive">{errors.socialWhatsappUrl.message}</p>
              )}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {mutation.isSuccess && !mutation.isPending && (
              <p className="text-sm text-muted-foreground">{t("admin.settings.saved")}</p>
            )}
            <div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("admin.settings.saving") : t("admin.settings.save")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

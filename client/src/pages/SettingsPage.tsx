import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
      : "Could not save the settings. Please try again."
    : null;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Store-wide delivery pricing, order handling, catalog defaults, and storefront contact
          info.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load settings. Please try again.
          </p>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="settings-delivery-fee">Delivery fee</Label>
              <Input
                id="settings-delivery-fee"
                type="number"
                min={0}
                aria-invalid={!!errors.deliveryFee}
                {...register("deliveryFee", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                Flat fee added to delivery orders. Pickup is always free.
              </p>
              {errors.deliveryFee && (
                <p className="text-sm text-destructive">{errors.deliveryFee.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-free-threshold">Free delivery threshold</Label>
              <Input
                id="settings-free-threshold"
                type="number"
                min={0}
                aria-invalid={!!errors.freeDeliveryThreshold}
                {...register("freeDeliveryThreshold", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                Orders at or above this total get free delivery. Leave blank to disable.
              </p>
              {errors.freeDeliveryThreshold && (
                <p className="text-sm text-destructive">
                  {errors.freeDeliveryThreshold.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-call-attempts">
                Failed call attempts before cancel offer
              </Label>
              <Input
                id="settings-call-attempts"
                type="number"
                min={1}
                aria-invalid={!!errors.callAttemptsBeforeCancel}
                {...register("callAttemptsBeforeCancel", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                After this many logged failed calls on a received order, staff are offered the
                option to cancel it as unreachable.
              </p>
              {errors.callAttemptsBeforeCancel && (
                <p className="text-sm text-destructive">
                  {errors.callAttemptsBeforeCancel.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-default-low-stock">Default low stock threshold</Label>
              <Input
                id="settings-default-low-stock"
                type="number"
                min={0}
                aria-invalid={!!errors.defaultLowStockThreshold}
                {...register("defaultLowStockThreshold", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                Pre-filled low stock threshold when creating a new product. Existing products keep
                their own value.
              </p>
              {errors.defaultLowStockThreshold && (
                <p className="text-sm text-destructive">
                  {errors.defaultLowStockThreshold.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-phone">Contact phone</Label>
              <Input
                id="settings-contact-phone"
                type="tel"
                aria-invalid={!!errors.contactPhone}
                {...register("contactPhone")}
              />
              <p className="text-sm text-muted-foreground">
                Shown on the storefront contact page. Leave blank to hide it.
              </p>
              {errors.contactPhone && (
                <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-email">Contact email</Label>
              <Input
                id="settings-contact-email"
                type="email"
                aria-invalid={!!errors.contactEmail}
                {...register("contactEmail")}
              />
              <p className="text-sm text-muted-foreground">
                Shown on the storefront contact page. Leave blank to hide it.
              </p>
              {errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-contact-address">Contact address</Label>
              <Input
                id="settings-contact-address"
                aria-invalid={!!errors.contactAddress}
                {...register("contactAddress")}
              />
              <p className="text-sm text-muted-foreground">
                Shown on the storefront contact page, linked to a map. Leave blank to hide it.
              </p>
              {errors.contactAddress && (
                <p className="text-sm text-destructive">{errors.contactAddress.message}</p>
              )}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {mutation.isSuccess && !mutation.isPending && (
              <p className="text-sm text-muted-foreground">Settings saved.</p>
            )}
            <div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

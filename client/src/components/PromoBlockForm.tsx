import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPromoBlockSchema,
  updatePromoBlockSchema,
  type UpdatePromoBlockFormInput,
  type UpdatePromoBlockInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PromoBlockRow } from "@/components/PromoBlocksTable";

// Native <input type="date"> wants "YYYY-MM-DD"; the API gives back an ISO
// timestamp string (or null for unbounded).
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function PromoBlockForm({
  promoBlock,
  onSuccess,
}: {
  promoBlock?: PromoBlockRow;
  onSuccess?: (promoBlock: PromoBlockRow) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePromoBlockFormInput, unknown, UpdatePromoBlockInput>({
    resolver: zodResolver(promoBlock ? updatePromoBlockSchema : createPromoBlockSchema),
    defaultValues: promoBlock
      ? {
          headline: { en: promoBlock.headline.en, ar: promoBlock.headline.ar ?? "" },
          copy: { en: promoBlock.copy?.en ?? "", ar: promoBlock.copy?.ar ?? "" },
          ctaLabel: promoBlock.ctaLabel ?? "",
          ctaUrl: promoBlock.ctaUrl ?? "",
          isActive: promoBlock.isActive,
          startsAt: toDateInputValue(promoBlock.startsAt),
          endsAt: toDateInputValue(promoBlock.endsAt),
          sortOrder: promoBlock.sortOrder,
        }
      : {
          headline: { en: "", ar: "" },
          copy: { en: "", ar: "" },
          ctaLabel: "",
          ctaUrl: "",
          isActive: true,
          startsAt: "",
          endsAt: "",
          sortOrder: 0,
        },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdatePromoBlockInput) =>
      promoBlock
        ? axios
            .put(`/api/promo-blocks/${promoBlock.id}`, input)
            .then((res) => res.data.promoBlock as PromoBlockRow)
        : axios
            .post("/api/promo-blocks", input)
            .then((res) => res.data.promoBlock as PromoBlockRow),
    onSuccess: (promoBlock) => {
      queryClient.invalidateQueries({ queryKey: ["promo-blocks"] });
      onSuccess?.(promoBlock);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : `Could not ${promoBlock ? "update" : "create"} the promo block. Please try again.`
    : null;

  const enHasError = !!errors.headline?.en || !!errors.copy?.en;
  const arHasError = !!errors.headline?.ar || !!errors.copy?.ar;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      className="grid gap-4"
    >
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">
            English
            {enHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
          <TabsTrigger value="ar">
            Arabic
            {arHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="promo-block-form-headline-en">Headline</Label>
            <Input
              id="promo-block-form-headline-en"
              autoComplete="off"
              aria-invalid={!!errors.headline?.en}
              {...register("headline.en")}
            />
            {errors.headline?.en && (
              <p className="text-sm text-destructive">{errors.headline.en.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="promo-block-form-copy-en">Copy</Label>
            <Textarea
              id="promo-block-form-copy-en"
              rows={3}
              aria-invalid={!!errors.copy?.en}
              {...register("copy.en")}
            />
            {errors.copy?.en && (
              <p className="text-sm text-destructive">{errors.copy.en.message}</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="ar" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="promo-block-form-headline-ar">Headline</Label>
            <Input
              id="promo-block-form-headline-ar"
              dir="rtl"
              autoComplete="off"
              aria-invalid={!!errors.headline?.ar}
              {...register("headline.ar")}
            />
            {errors.headline?.ar && (
              <p className="text-sm text-destructive">{errors.headline.ar.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="promo-block-form-copy-ar">Copy</Label>
            <Textarea
              id="promo-block-form-copy-ar"
              dir="rtl"
              rows={3}
              aria-invalid={!!errors.copy?.ar}
              {...register("copy.ar")}
            />
            {errors.copy?.ar && (
              <p className="text-sm text-destructive">{errors.copy.ar.message}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="promo-block-form-cta-label">CTA label</Label>
          <Input
            id="promo-block-form-cta-label"
            autoComplete="off"
            placeholder="Shop now"
            aria-invalid={!!errors.ctaLabel}
            {...register("ctaLabel")}
          />
          {errors.ctaLabel && (
            <p className="text-sm text-destructive">{errors.ctaLabel.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="promo-block-form-cta-url">CTA link</Label>
          <Input
            id="promo-block-form-cta-url"
            autoComplete="off"
            placeholder="https://example.com/sale"
            aria-invalid={!!errors.ctaUrl}
            {...register("ctaUrl")}
          />
          {errors.ctaUrl && <p className="text-sm text-destructive">{errors.ctaUrl.message}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="promo-block-form-starts-at">Start date</Label>
          <Input
            id="promo-block-form-starts-at"
            type="date"
            aria-invalid={!!errors.startsAt}
            {...register("startsAt")}
          />
          <p className="text-sm text-muted-foreground">Leave blank to show right away.</p>
          {errors.startsAt && (
            <p className="text-sm text-destructive">{errors.startsAt.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="promo-block-form-ends-at">End date</Label>
          <Input
            id="promo-block-form-ends-at"
            type="date"
            aria-invalid={!!errors.endsAt}
            {...register("endsAt")}
          />
          <p className="text-sm text-muted-foreground">Leave blank to never expire.</p>
          {errors.endsAt && <p className="text-sm text-destructive">{errors.endsAt.message}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="promo-block-form-sort-order">Order</Label>
          <Input
            id="promo-block-form-sort-order"
            type="number"
            min={0}
            aria-invalid={!!errors.sortOrder}
            {...register("sortOrder", { valueAsNumber: true })}
          />
          {errors.sortOrder && (
            <p className="text-sm text-destructive">{errors.sortOrder.message}</p>
          )}
        </div>
        <Label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="promo-block-form-is-active"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          Active (shown on the storefront)
        </Label>
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {promoBlock
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Creating…"
              : "Create promo block"}
        </Button>
      </DialogFooter>
    </form>
  );
}

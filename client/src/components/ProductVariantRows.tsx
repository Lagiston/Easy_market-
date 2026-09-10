import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { productVariantRowSchema } from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Loosely-typed controlled-input state for one repeatable variant row — kept
// separate from ProductVariantRowFormInput (whose price/stock are strictly
// `number`, since that's what actually gets submitted) because a number
// input's empty state has to be representable as "" while the field is being
// edited, the same reason the base ProductForm's own price/stock fields use
// RHF's `valueAsNumber` rather than a plain controlled `number` value.
export type VariantRowValues = {
  size: string;
  color: string;
  price: number | "";
  salePrice: number | "";
  stock: number | "";
};

export type VariantRowStatus = "idle" | "pending" | "done" | "error";

export type VariantRowState = {
  id: string;
  values: VariantRowValues;
  errors: Partial<Record<keyof VariantRowValues, string>>;
  status: VariantRowStatus;
  errorMessage?: string;
};

export function emptyVariantRowValues(): VariantRowValues {
  return { size: "", color: "", price: "", salePrice: "", stock: "" };
}

// Validates one row's current values against the shared core schema,
// returning a field->message map (empty when valid) for inline display —
// mirrors the shape of RHF's own `errors` object closely enough that the
// row's Input components can follow the same `aria-invalid`/error-paragraph
// pattern as every other field in ProductForm.
export function validateVariantRow(values: VariantRowValues): VariantRowState["errors"] {
  const result = productVariantRowSchema.safeParse(values);
  if (result.success) return {};
  const errors: VariantRowState["errors"] = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof VariantRowValues | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export default function ProductVariantRows({
  rows,
  onAdd,
  onRemove,
  onChange,
  disabled,
}: {
  rows: VariantRowState[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<VariantRowValues>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t("admin.products.form.variantsHeading")}</p>
          <p className="text-xs text-muted-foreground">{t("admin.products.form.variantsHint")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
          {t("admin.products.form.addVariant")}
        </Button>
      </div>
      {rows.length > 0 && (
        <ul className="grid gap-3">
          {rows.map((row, index) => (
            <li key={row.id} className="grid gap-2 rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("admin.products.form.variantRowLabel", { index: index + 1 })}
                </span>
                <div className="flex items-center gap-2">
                  {row.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      {t("admin.products.form.variantPending")}
                    </span>
                  )}
                  {row.status === "done" && (
                    <span className="text-xs text-primary">
                      {t("admin.products.form.variantDone")}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t("admin.products.form.removeVariantAria", { index: index + 1 })}
                    disabled={disabled}
                    onClick={() => onRemove(row.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`variant-${row.id}-size`}>
                    {t("admin.products.form.variantSize")}
                  </Label>
                  <Input
                    id={`variant-${row.id}-size`}
                    placeholder={t("admin.products.form.sizePlaceholder")}
                    disabled={disabled}
                    aria-invalid={!!row.errors.size}
                    value={row.values.size}
                    onChange={(event) => onChange(row.id, { size: event.target.value })}
                  />
                  {row.errors.size && (
                    <p className="text-sm text-destructive">{row.errors.size}</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`variant-${row.id}-color`}>
                    {t("admin.products.form.variantColor")}
                  </Label>
                  <Input
                    id={`variant-${row.id}-color`}
                    placeholder={t("admin.products.form.colorPlaceholder")}
                    disabled={disabled}
                    aria-invalid={!!row.errors.color}
                    value={row.values.color}
                    onChange={(event) => onChange(row.id, { color: event.target.value })}
                  />
                  {row.errors.color && (
                    <p className="text-sm text-destructive">{row.errors.color}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`variant-${row.id}-price`}>
                    {t("admin.products.form.variantPrice")}
                  </Label>
                  <Input
                    id={`variant-${row.id}-price`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={disabled}
                    aria-invalid={!!row.errors.price}
                    value={row.values.price}
                    onChange={(event) => onChange(row.id, { price: event.target.valueAsNumber })}
                  />
                  {row.errors.price && (
                    <p className="text-sm text-destructive">{row.errors.price}</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`variant-${row.id}-sale-price`}>
                    {t("admin.products.form.variantSalePrice")}
                  </Label>
                  <Input
                    id={`variant-${row.id}-sale-price`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder={t("admin.products.form.salePricePlaceholder")}
                    disabled={disabled}
                    aria-invalid={!!row.errors.salePrice}
                    value={row.values.salePrice}
                    onChange={(event) =>
                      onChange(row.id, { salePrice: event.target.valueAsNumber })
                    }
                  />
                  {row.errors.salePrice && (
                    <p className="text-sm text-destructive">{row.errors.salePrice}</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`variant-${row.id}-stock`}>
                    {t("admin.products.form.variantStock")}
                  </Label>
                  <Input
                    id={`variant-${row.id}-stock`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={disabled}
                    aria-invalid={!!row.errors.stock}
                    value={row.values.stock}
                    onChange={(event) => onChange(row.id, { stock: event.target.valueAsNumber })}
                  />
                  {row.errors.stock && (
                    <p className="text-sm text-destructive">{row.errors.stock}</p>
                  )}
                </div>
              </div>
              {row.status === "error" && row.errorMessage && (
                <p className="text-sm text-destructive">{row.errorMessage}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

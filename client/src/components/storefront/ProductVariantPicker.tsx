import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";
import type { StorefrontProduct } from "@/pages/storefront/ProductsPage";

// Renders a "Choose options" size/color picker for a storefront product's
// variant group, reusing the existing variantGroupId linking mechanism —
// each option is a genuinely separate Product row, not a per-SKU attribute
// on one row, so a click is plain navigation to the matching sibling.
export default function ProductVariantPicker({
  product,
  relatedProducts,
}: {
  product: StorefrontProduct;
  relatedProducts: StorefrontProduct[];
}) {
  const { t } = useTranslation();
  const group = [product, ...relatedProducts];

  const sizes = Array.from(new Set(group.map((p) => p.size).filter((v): v is string => !!v)));
  const colors = Array.from(new Set(group.map((p) => p.color).filter((v): v is string => !!v)));

  if (sizes.length === 0 && colors.length === 0) {
    return null;
  }

  // Values are only ever drawn from the group's own members (see sizes/colors
  // above), so a match always exists — this is a single-attribute lookup,
  // not a full cross-attribute (size, color) combination matrix, which would
  // need a nested per-SKU attribute model this codebase deliberately avoids
  // (each variant is still just a separate Product row). What CAN legitimately
  // be unavailable is stock: a matching sibling that's sold out still shows
  // as an option (so the customer can see it exists) but renders disabled
  // rather than linking to a product they can't buy.
  function findMatch(attribute: "size" | "color", value: string) {
    return group.find((p) => p[attribute] === value)!;
  }

  function renderRow(attribute: "size" | "color", values: string[]) {
    const current = product[attribute];
    const labelKey = attribute === "size" ? "products.variants.size" : "products.variants.color";
    const selectKey =
      attribute === "size" ? "products.variants.selectSize" : "products.variants.selectColor";
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t(labelKey)}</p>
        <div className="flex flex-wrap gap-2">
          {values.map((value) => {
            const match = findMatch(attribute, value);
            const isSelected = value === current;
            if (match.stock === 0) {
              return (
                <span
                  key={value}
                  aria-disabled="true"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "cursor-not-allowed opacity-50",
                  })}
                >
                  {value}
                </span>
              );
            }
            return (
              <Link
                key={value}
                to={`/products/${match.id}`}
                aria-pressed={isSelected}
                aria-label={t(selectKey, { [attribute]: value })}
                className={buttonVariants({
                  variant: isSelected ? "default" : "outline",
                  size: "sm",
                })}
              >
                {value}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sizes.length > 0 && renderRow("size", sizes)}
      {colors.length > 0 && renderRow("color", colors)}
    </div>
  );
}

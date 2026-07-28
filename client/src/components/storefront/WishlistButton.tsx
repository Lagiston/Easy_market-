import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { useWishlist } from "@/lib/wishlist";
import { Button, buttonVariants } from "@/components/ui/button";

// Heart-icon toggle for a product's wishlist membership. Guests get a plain
// link to sign in (matching CustomerProtectedRoute's no-return-to-param
// redirect — there's no precedent for one elsewhere in this codebase)
// instead of a JS-driven navigate, so the click is a natural anchor.
export default function WishlistButton({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { data: session } = customerAuthClient.useSession();
  const { isWishlisted, addMutation, removeMutation } = useWishlist();

  if (!session) {
    return (
      <Link
        to="/account/login"
        aria-label={t("wishlist.add")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <Heart className="size-4" />
      </Link>
    );
  }

  const wishlisted = isWishlisted(productId);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={wishlisted}
      aria-label={t(wishlisted ? "wishlist.remove" : "wishlist.add")}
      disabled={addMutation.isPending || removeMutation.isPending}
      onClick={() =>
        wishlisted ? removeMutation.mutate(productId) : addMutation.mutate(productId)
      }
    >
      <Heart className={wishlisted ? "size-4 fill-primary text-primary" : "size-4"} />
    </Button>
  );
}

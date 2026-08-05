import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { User as UserIcon } from "lucide-react";
import type { Gender } from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { GENDER_LABEL_KEYS } from "./AccountProfilePage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = customerAuthClient.useSession();

  async function handleSignOut() {
    await customerAuthClient.signOut();
    navigate("/", { replace: true });
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{t("account.title")}</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={t("account.profile.avatarAlt")}
                className="size-10 shrink-0 rounded-full border bg-white object-cover"
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted">
                <UserIcon className="size-5 text-muted-foreground" />
              </div>
            )}
            <CardTitle>{session.user.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
            {/* Each field is independently optional — shown only when set,
                same "omit rather than show empty" convention as the
                averageRating line on a product card. */}
            {session.user.mobile && (
              <p className="text-sm text-muted-foreground">
                {t("account.profile.mobile")}: {session.user.mobile}
              </p>
            )}
            {session.user.gender && (
              <p className="text-sm text-muted-foreground">
                {t("account.profile.gender")}:{" "}
                {t(GENDER_LABEL_KEYS[session.user.gender as Gender])}
              </p>
            )}
            {session.user.region && (
              <p className="text-sm text-muted-foreground">
                {t("account.profile.region")}: {session.user.region}
              </p>
            )}
          </div>
          <Link
            to="/account/profile"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("account.editProfile")}
          </Link>
          <Link
            to="/account/orders"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("account.myOrders")}
          </Link>
          <Link
            to="/account/wishlist"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("account.myWishlist")}
          </Link>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            {t("account.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

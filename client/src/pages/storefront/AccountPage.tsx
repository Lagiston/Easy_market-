import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { customerAuthClient } from "@/lib/customer-auth-client";
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
          <CardTitle>{session.user.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
          <Link
            to="/account/orders"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("account.myOrders")}
          </Link>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            {t("account.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

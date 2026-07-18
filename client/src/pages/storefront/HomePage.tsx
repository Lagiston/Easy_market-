import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { HandCoins, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { key: "payOnDelivery", Icon: HandCoins },
  { key: "delivery", Icon: Truck },
  { key: "pickup", Icon: Store },
] as const;

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-4xl font-semibold">{t("home.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("home.subtitle")}</p>
        <Button size="lg" render={<Link to="/products" />}>
          {t("home.cta")}
        </Button>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ key, Icon }) => (
          <Card key={key}>
            <CardContent className="space-y-2 p-6">
              <Icon aria-hidden className="size-6 text-primary" />
              <h2 className="font-medium">{t(`home.features.${key}.title`)}</h2>
              <p className="text-sm text-muted-foreground">
                {t(`home.features.${key}.text`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

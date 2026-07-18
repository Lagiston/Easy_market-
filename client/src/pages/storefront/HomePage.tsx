import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl space-y-2 text-center">
      <h1 className="text-3xl font-semibold">{t("home.title")}</h1>
      <p className="text-muted-foreground">{t("home.subtitle")}</p>
    </div>
  );
}

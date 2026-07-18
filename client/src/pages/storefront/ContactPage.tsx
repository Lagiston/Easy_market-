import { useTranslation } from "react-i18next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Store contact details — placeholder values until the real ones are provided
// before launch (see implementation-plan.md 8.5, seeding real content).
const PHONE = "+255 700 000 000";
const EMAIL = "hello@es-market.example";

export default function ContactPage() {
  const { t } = useTranslation();

  const rows = [
    {
      key: "phone",
      Icon: Phone,
      value: <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{PHONE}</a>,
    },
    {
      key: "email",
      Icon: Mail,
      value: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>,
    },
    { key: "address", Icon: MapPin, value: t("contact.addressValue") },
    { key: "hours", Icon: Clock, value: t("contact.hoursValue") },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">{t("contact.title")}</h1>
        <p className="text-muted-foreground">{t("contact.subtitle")}</p>
      </div>
      <Card>
        <CardContent className="divide-y p-6">
          {rows.map(({ key, Icon, value }) => (
            <div key={key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <Icon aria-hidden className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t(`contact.${key}`)}</p>
                <p className="font-medium">{value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

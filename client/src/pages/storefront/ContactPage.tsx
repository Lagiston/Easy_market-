import { useTranslation } from "react-i18next";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { createInquirySchema, type CreateInquiryFormInput } from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInquiryFormInput>({
    resolver: zodResolver(createInquirySchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateInquiryFormInput) =>
      axios.post("/api/storefront/inquiries", input).then((res) => res.data),
    onSuccess: () => reset(),
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("contact.error")
    : null;

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
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold">{t("contact.formTitle")}</h2>
          <form
            noValidate
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="contact-name">{t("contact.name")}</Label>
              <Input
                id="contact-name"
                autoComplete="name"
                aria-invalid={!!errors.customerName}
                {...register("customerName")}
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-email">{t("contact.email")}</Label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.customerEmail}
                {...register("customerEmail")}
              />
              {errors.customerEmail && (
                <p className="text-sm text-destructive">{errors.customerEmail.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-phone">{t("contact.phone")}</Label>
              <Input
                id="contact-phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.customerPhone}
                {...register("customerPhone")}
              />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-message">{t("contact.message")}</Label>
              <Textarea
                id="contact-message"
                rows={4}
                aria-invalid={!!errors.message}
                {...register("message")}
              />
              {errors.message && (
                <p className="text-sm text-destructive">{errors.message.message}</p>
              )}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {mutation.isSuccess && (
              <p className="text-sm text-primary">{t("contact.success")}</p>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("contact.sending") : t("contact.send")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

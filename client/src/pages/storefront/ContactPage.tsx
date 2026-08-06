import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import {
  createInquirySchema,
  INQUIRY_MESSAGE_MAX_LENGTH,
  type CreateInquiryFormInput,
  type Language,
} from "@es-market/core";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { buildContactLinks, CONTACT_ICONS } from "@/lib/contact-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const { data: settings } = usePublicStoreSettings();

  // Phone/email/address are admin-configured (Settings page) and hidden here
  // until set, rather than shown blank — hours stay a plain translated string
  // since there's no store-hours setting yet.
  const rows: { key: string; Icon: typeof Clock; value: ReactNode }[] = [
    ...buildContactLinks(settings).map(({ key, href, label, external }) => ({
      key,
      Icon: CONTACT_ICONS[key],
      value: (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {label}
        </a>
      ),
    })),
    { key: "hours", Icon: Clock, value: t("contact.hoursValue") },
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateInquiryFormInput>({
    resolver: zodResolver(createInquirySchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", message: "" },
  });

  const messageLength = (watch("message") ?? "").length;
  const isMessageOverLimit = messageLength > INQUIRY_MESSAGE_MAX_LENGTH;

  const mutation = useMutation({
    mutationFn: (input: CreateInquiryFormInput) =>
      axios
        .post<{ inquiry: { id: string; code: string } }>("/api/storefront/inquiries", input)
        .then((res) => res.data.inquiry),
    onSuccess: () => {
      reset();
      toast.success(t("contact.success"));
    },
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
      {mutation.isSuccess && (
        <Card className="py-0">
          <CardContent className="space-y-1 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("contact.referenceCodeLabel")}</p>
            <p className="font-mono text-lg font-semibold tracking-widest">
              {mutation.data.code}
            </p>
            <p className="text-xs text-muted-foreground">{t("contact.referenceCodeHint")}</p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-1 text-lg font-semibold">{t("contact.formTitle")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("contact.responseTime")}</p>
          <form
            noValidate
            onSubmit={handleSubmit((input) =>
              mutation.mutate({ ...input, language: (i18n.resolvedLanguage ?? "en") as Language }),
            )}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="contact-name">{t("contact.name")}</Label>
              <Input
                id="contact-name"
                autoComplete="name"
                disabled={mutation.isPending}
                aria-invalid={!!errors.customerName}
                {...register("customerName")}
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.customerName.message, t)}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-email">{t("contact.email")}</Label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                disabled={mutation.isPending}
                aria-invalid={!!errors.customerEmail}
                {...register("customerEmail")}
              />
              {errors.customerEmail && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.customerEmail.message, t)}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-phone">{t("contact.phone")}</Label>
              <Input
                id="contact-phone"
                type="tel"
                autoComplete="tel"
                disabled={mutation.isPending}
                aria-invalid={!!errors.customerPhone}
                {...register("customerPhone")}
              />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.customerPhone.message, t)}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact-message">{t("contact.message")}</Label>
              <Textarea
                id="contact-message"
                rows={4}
                disabled={mutation.isPending}
                aria-invalid={!!errors.message}
                {...register("message")}
              />
              {errors.message && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.message.message, t)}
                </p>
              )}
              <p
                className={`text-end text-xs ${
                  isMessageOverLimit ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {t("contact.messageCount", {
                  count: messageLength,
                  max: INQUIRY_MESSAGE_MAX_LENGTH,
                })}
              </p>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("contact.sending") : t("contact.send")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

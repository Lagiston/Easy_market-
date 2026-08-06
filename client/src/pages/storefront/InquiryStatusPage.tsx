import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  inquiryLookupSchema,
  InquiryStatus,
  MessageSender,
  type InquiryLookupFormInput,
} from "@es-market/core";
import { setStoredInquiryId } from "@/lib/inquiry-session";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LookupMessage = {
  id: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
};

type LookupInquiry = {
  id: string;
  code: string;
  status: InquiryStatus;
  messages: LookupMessage[];
};

const STATUS_KEYS: Record<InquiryStatus, string> = {
  OPEN: "inquiryStatus.statuses.open",
  RESOLVED: "inquiryStatus.statuses.resolved",
  CLOSED: "inquiryStatus.statuses.closed",
};

export default function InquiryStatusPage() {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InquiryLookupFormInput>({
    resolver: zodResolver(inquiryLookupSchema),
    defaultValues: { code: "", email: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: InquiryLookupFormInput) =>
      axios
        .get<{ inquiry: LookupInquiry }>("/api/storefront/inquiries/lookup", { params: input })
        .then((res) => res.data.inquiry),
    onSuccess: (inquiry) => {
      // Lets the chat widget resume this thread too, e.g. after a guest lost
      // localStorage but still knows their code + email.
      setStoredInquiryId(inquiry.id);
    },
  });

  const notFound =
    mutation.isError &&
    axios.isAxiosError(mutation.error) &&
    mutation.error.response?.status === 404;
  const inquiry = mutation.data;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("inquiryStatus.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("inquiryStatus.subtitle")}</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((input) => mutation.mutate(input))}
        className="grid gap-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-code">{t("inquiryStatus.code")}</Label>
          <Input
            id="lookup-code"
            autoComplete="off"
            className="uppercase"
            aria-invalid={!!errors.code}
            {...register("code")}
          />
          {errors.code && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.code.message, t)}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-email">{t("inquiryStatus.email")}</Label>
          <Input
            id="lookup-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.email.message, t)}
            </p>
          )}
        </div>
        {notFound ? (
          <p className="text-sm text-destructive">{t("inquiryStatus.notFound")}</p>
        ) : mutation.isError ? (
          <p className="text-sm text-destructive">{t("inquiryStatus.error")}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t("inquiryStatus.checking") : t("inquiryStatus.check")}
        </Button>
      </form>

      {inquiry && (
        <Card className="py-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-lg font-semibold tracking-widest">{inquiry.code}</p>
              <Badge variant={inquiry.status === InquiryStatus.CLOSED ? "secondary" : "default"}>
                {t(STATUS_KEYS[inquiry.status])}
              </Badge>
            </div>
            <div className="space-y-3 border-t pt-3">
              {inquiry.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.sender === MessageSender.CUSTOMER
                      ? "ms-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "me-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

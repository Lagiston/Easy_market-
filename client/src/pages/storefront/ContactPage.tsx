import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import {
  createInquirySchema,
  CONTACT_MESSAGE_MAX_LENGTH,
  INQUIRY_TOPICS,
  InquiryTopic,
  type CreateInquiryFormInput,
  type Language,
} from "@es-market/core";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { formatPhoneDisplay, buildWhatsAppLink } from "@/lib/contact-links";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// No admin-configurable social settings exist anywhere in this codebase yet —
// these three are plain hardcoded links (confirmed with the store owner),
// not sourced from Settings like phone/email/address are.
const SOCIAL_LINKS = [
  { key: "instagram", href: "https://instagram.com/halatu", Icon: InstagramIcon },
  { key: "tiktok", href: "https://tiktok.com/@halatu", Icon: TiktokIcon },
  { key: "facebook", href: "https://facebook.com/halatu", Icon: FacebookIcon },
] as const;

const TOPIC_LABEL_KEYS: Record<InquiryTopic, string> = {
  [InquiryTopic.ORDER_ISSUE]: "contact.topicOrderIssue",
  [InquiryTopic.PRODUCT_QUESTION]: "contact.topicProductQuestion",
  [InquiryTopic.RETURNS_REFUND]: "contact.topicReturnsRefund",
  [InquiryTopic.WHOLESALE_BULK]: "contact.topicWholesaleBulk",
  [InquiryTopic.OTHER]: "contact.topicOther",
};

// Mon–Sat 8:00–20:00, Sun 9:00–14:00 — a fixed schedule, not an admin
// setting (no such setting exists), matching the previous plain-text
// "hoursValue" string this replaces.
type DayHours = { opensAt: string; closesAt: string; opensMinute: number; closesMinute: number };
const WEEKDAY_HOURS: DayHours = { opensAt: "8:00", closesAt: "20:00", opensMinute: 8 * 60, closesMinute: 20 * 60 };
const SUNDAY_HOURS: DayHours = { opensAt: "9:00", closesAt: "14:00", opensMinute: 9 * 60, closesMinute: 14 * 60 };

type OpenStatus = { isOpen: boolean; isSunday: boolean; hours: DayHours };

function computeOpenStatus(now: Date): OpenStatus {
  const isSunday = now.getDay() === 0;
  const hours = isSunday ? SUNDAY_HOURS : WEEKDAY_HOURS;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return { isOpen: minutesNow >= hours.opensMinute && minutesNow < hours.closesMinute, isSunday, hours };
}

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const { data: settings } = usePublicStoreSettings();

  const [openStatus, setOpenStatus] = useState<OpenStatus | null>(null);
  useEffect(() => {
    setOpenStatus(computeOpenStatus(new Date()));
  }, []);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateInquiryFormInput>({
    resolver: zodResolver(createInquirySchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", message: "" },
  });

  const messageLength = (watch("message") ?? "").length;
  const isMessageOverLimit = messageLength > CONTACT_MESSAGE_MAX_LENGTH;

  const mutation = useMutation({
    mutationFn: (input: CreateInquiryFormInput) =>
      axios
        .post<{ inquiry: { id: string; code: string } }>("/api/storefront/inquiries", input)
        .then((res) => res.data.inquiry),
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("contact.error")
    : null;

  const phone = settings?.contactPhone ?? null;
  const whatsAppHref = phone ? buildWhatsAppLink(phone) : null;
  const callHref = phone ? `tel:${phone.replace(/\s/g, "")}` : null;
  const mapQuery = settings?.contactAddress ? encodeURIComponent(settings.contactAddress) : null;

  return (
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-[#0a0c0b] px-6 py-14 font-dm-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div className="relative mx-auto max-w-[1160px] space-y-10">
        <div className="space-y-3 text-center">
          <h1 className="text-[44px] font-extrabold tracking-[-0.035em]">{t("contact.title")}</h1>
          <p className="text-neutral-400">{t("contact.subtitle")}</p>
        </div>

        {(whatsAppHref || callHref) && (
          <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            {whatsAppHref && (
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#25d366] px-5 font-bold text-[#04240f] transition-transform hover:scale-[1.02] motion-reduce:transition-none"
              >
                <MessageCircle aria-hidden className="size-5" />
                {t("contact.whatsapp")}
              </a>
            )}
            {callHref && (
              <a
                href={callHref}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] border border-white/[0.07] bg-white/[0.032] px-5 font-bold text-white backdrop-blur-xl transition-colors hover:bg-white/[0.06] reduced-transparency:bg-neutral-900 reduced-transparency:backdrop-blur-none"
              >
                <Phone aria-hidden className="size-5" />
                {t("contact.call")}
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[0.85fr_1fr]">
          {/* Details panel */}
          <div className="space-y-6 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
            {openStatus && (
              <div className="space-y-3 border-b border-white/[0.07] pb-5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    openStatus.isOpen
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-white/[0.06] text-neutral-400",
                  )}
                >
                  <Clock aria-hidden className="size-3.5" />
                  {openStatus.isOpen
                    ? t("contact.openNow", { time: openStatus.hours.closesAt })
                    : t("contact.closedNow", { time: openStatus.hours.opensAt })}
                </span>
                <div className="space-y-1 text-sm">
                  <div
                    className={cn(
                      "flex justify-between",
                      !openStatus.isSunday ? "text-white" : "text-neutral-500",
                    )}
                  >
                    <span>{t("contact.hoursMonSat")}</span>
                    <span>{t("contact.hoursMonSatTime")}</span>
                  </div>
                  <div
                    className={cn(
                      "flex justify-between",
                      openStatus.isSunday ? "text-white" : "text-neutral-500",
                    )}
                  >
                    <span>{t("contact.hoursSun")}</span>
                    <span>{t("contact.hoursSunTime")}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              {settings?.contactPhone && (
                <ContactRow
                  Icon={Phone}
                  label={t("contact.phone")}
                  href={`tel:${settings.contactPhone.replace(/\s/g, "")}`}
                  value={formatPhoneDisplay(settings.contactPhone)}
                  hint={t("contact.phoneHint")}
                />
              )}
              {settings?.contactEmail && (
                <ContactRow
                  Icon={Mail}
                  label={t("contact.email")}
                  href={`mailto:${settings.contactEmail}`}
                  value={settings.contactEmail}
                  hint={t("contact.emailHint")}
                />
              )}
              {settings?.contactAddress && (
                <ContactRow
                  Icon={MapPin}
                  label={t("contact.address")}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.contactAddress)}`}
                  external
                  value={settings.contactAddress}
                  hint={t("contact.addressHint")}
                  last
                />
              )}
            </div>

            {mapQuery && (
              <div className="relative h-[170px] overflow-hidden rounded-2xl border border-white/[0.07]">
                <iframe
                  title={t("contact.address")}
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  className="size-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute end-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/85"
                >
                  {t("contact.getDirections")}
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </a>
              </div>
            )}

            <div className="space-y-3 border-t border-white/[0.07] pt-5">
              <p className="text-xs font-semibold tracking-[0.06em] text-neutral-500 uppercase">
                {t("contact.followUs")}
              </p>
              <div className="flex gap-3">
                {SOCIAL_LINKS.map(({ key, href, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.032] text-white backdrop-blur-xl transition-transform hover:-translate-y-0.5 hover:bg-white/[0.06] motion-reduce:transition-none reduced-transparency:bg-neutral-900 reduced-transparency:backdrop-blur-none"
                  >
                    <Icon aria-hidden className="size-4.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
            {mutation.isSuccess ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 aria-hidden className="size-12 text-sky-500" />
                <h2 className="text-xl font-bold">{t("contact.successTitle")}</h2>
                <p className="max-w-sm text-sm text-neutral-400">{t("contact.successDetail")}</p>
                <div className="mt-2 rounded-[13px] border border-sky-500/25 bg-sky-500/[0.07] px-5 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                    {t("contact.messageCodeLabel")}
                  </p>
                  <p className="text-[20px] font-extrabold tracking-[0.08em] text-white">
                    {mutation.data.code}
                  </p>
                </div>
                <p className="max-w-sm text-[12.5px] text-neutral-500">
                  {t("contact.messageCodeHint")}
                </p>
                <Link
                  to="/track"
                  className="mt-1 inline-flex h-10 items-center gap-2 rounded-[13px] border border-sky-500/30 bg-sky-500/10 px-4 text-sm font-semibold text-sky-300 hover:bg-sky-500/15"
                >
                  {t("contact.trackMessage")}
                </Link>
              </div>
            ) : (
              <>
                <h2 className="mb-1 text-lg font-semibold">{t("contact.formTitle")}</h2>
                <p className="mb-5 text-sm text-neutral-400">{t("contact.responseTime")}</p>
                <form
                  noValidate
                  onSubmit={handleSubmit((input) =>
                    mutation.mutate({
                      ...input,
                      language: (i18n.resolvedLanguage ?? "en") as Language,
                    }),
                  )}
                  className="grid gap-4"
                >
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="contact-topic" required>
                      {t("contact.topicLabel")}
                    </FieldLabel>
                    <Controller
                      name="topic"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="contact-topic"
                            className={CONTROL_CLASS}
                            aria-invalid={!!errors.topic}
                          >
                            <SelectValue placeholder={t("contact.topicPlaceholder")}>
                              {(value: InquiryTopic) => t(TOPIC_LABEL_KEYS[value])}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {INQUIRY_TOPICS.map((topic) => (
                              <SelectItem key={topic} value={topic}>
                                {t(TOPIC_LABEL_KEYS[topic])}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.topic && (
                      <p className="text-sm text-red-400">
                        {translateFieldError(errors.topic.message, t)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="contact-name" required>
                        {t("contact.name")}
                      </FieldLabel>
                      <Input
                        id="contact-name"
                        autoComplete="name"
                        disabled={mutation.isPending}
                        aria-invalid={!!errors.customerName}
                        className={CONTROL_CLASS}
                        {...register("customerName")}
                      />
                      {errors.customerName && (
                        <p className="text-sm text-red-400">
                          {translateFieldError(errors.customerName.message, t)}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="contact-phone" required>
                        {t("contact.phone")}
                      </FieldLabel>
                      <Input
                        id="contact-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder={t("contact.phonePlaceholder")}
                        disabled={mutation.isPending}
                        aria-invalid={!!errors.customerPhone}
                        className={CONTROL_CLASS}
                        {...register("customerPhone")}
                      />
                      {errors.customerPhone && (
                        <p className="text-sm text-red-400">
                          {translateFieldError(errors.customerPhone.message, t)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <FieldLabel htmlFor="contact-email">{t("contact.email")}</FieldLabel>
                    <Input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      disabled={mutation.isPending}
                      aria-invalid={!!errors.customerEmail}
                      className={CONTROL_CLASS}
                      {...register("customerEmail")}
                    />
                    <p className="text-[12.5px] text-neutral-500">{t("contact.emailOptionalHint")}</p>
                    {errors.customerEmail && (
                      <p className="text-sm text-red-400">
                        {translateFieldError(errors.customerEmail.message, t)}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <FieldLabel htmlFor="contact-message" required>
                      {t("contact.message")}
                    </FieldLabel>
                    <Textarea
                      id="contact-message"
                      rows={5}
                      placeholder={t("contact.messagePlaceholder")}
                      disabled={mutation.isPending}
                      aria-invalid={!!errors.message}
                      className="min-h-[130px] rounded-xl border-white/[0.07] bg-white/[0.04] focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]"
                      {...register("message")}
                    />
                    <p
                      className={cn(
                        "text-end text-xs",
                        isMessageOverLimit ? "text-red-400" : "text-neutral-500",
                      )}
                    >
                      {t("contact.messageCount", {
                        count: messageLength,
                        max: CONTACT_MESSAGE_MAX_LENGTH,
                      })}
                    </p>
                    {errors.message && (
                      <p className="text-sm text-red-400">
                        {translateFieldError(errors.message.message, t)}
                      </p>
                    )}
                  </div>

                  {serverError && <p className="text-sm text-red-400">{serverError}</p>}

                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="h-[50px] w-full gap-2 rounded-[13px] bg-sky-500 font-bold text-[#06140b] hover:bg-sky-400"
                  >
                    <Send aria-hidden className="size-4" />
                    {mutation.isPending ? t("contact.sending") : t("contact.send")}
                  </Button>
                  <p className="text-center text-[12.5px] text-neutral-500">
                    {t("contact.privacyNote")}
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CONTROL_CLASS =
  "h-[46px] rounded-xl border-white/[0.07] bg-white/[0.04] focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]";

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium text-neutral-300">
      {children}
      {required ? (
        <span className="text-sky-500"> *</span>
      ) : (
        <span className="text-neutral-500"> {t("contact.optionalLabel")}</span>
      )}
    </Label>
  );
}

function ContactRow({
  Icon,
  label,
  href,
  value,
  hint,
  external,
  last,
}: {
  Icon: typeof Phone;
  label: string;
  href: string;
  value: string;
  hint: string;
  external?: boolean;
  last?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group flex items-start gap-3.5 py-4",
        !last && "border-b border-white/[0.07]",
      )}
    >
      <span className="grid size-[38px] shrink-0 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10">
        <Icon aria-hidden className="size-4.5 text-sky-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold tracking-[0.06em] text-neutral-500 uppercase">
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-semibold text-white transition-colors group-hover:text-sky-500">
            {value}
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-sky-500 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </span>
        <span className="block text-[12.5px] text-neutral-500">{hint}</span>
      </span>
    </a>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.65 15.4 3.55 14.25 3.55c-2.4 0-4.05 1.47-4.05 4.15V9.9H7.5V13h2.7v8h3.3Z" />
    </svg>
  );
}

function TiktokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.5 3c.4 2.1 1.7 3.4 4 3.6v2.9c-1.4 0-2.8-.4-4-1.2v6.5a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.07v3a3 3 0 1 0 2.1 2.86V3h2.9Z" />
    </svg>
  );
}

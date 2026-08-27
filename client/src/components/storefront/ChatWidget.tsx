import { useEffect, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addMessageSchema,
  createInquirySchema,
  InquiryStatus,
  InquiryTopic,
  MessageSender,
  type AddMessageFormInput,
  type CreateInquiryFormInput,
  type Language,
} from "@es-market/core";
import {
  clearStoredInquiryId,
  getStoredInquiryId,
  setStoredInquiryId,
} from "@/lib/inquiry-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ThreadMessage = {
  id: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
};

type Thread = {
  id: string;
  status: InquiryStatus;
  messages: ThreadMessage[];
};

const POLL_INTERVAL_MS = 4000;

// Lets other pages (e.g. TrackPage's "Chat with us" fallback) open the
// widget without a real client-side dependency between unrelated pages —
// same "small, explicit escape hatch" spirit as this codebase's other
// window-scoped globals. Declared here since ChatWidget is the sole owner.
declare global {
  interface Window {
    HalatuChat?: { open: () => void };
  }
}

export default function ChatWidget() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inquiryId, setInquiryId] = useState<string | null>(() => getStoredInquiryId());

  useEffect(() => {
    window.HalatuChat = { open: () => setOpen(true) };
    return () => {
      delete window.HalatuChat;
    };
  }, []);

  const threadQuery = useQuery({
    queryKey: ["inquiry-thread", inquiryId],
    queryFn: () =>
      axios
        .get<{ inquiry: Thread }>(`/api/storefront/inquiries/${inquiryId}`)
        .then((res) => res.data.inquiry),
    enabled: open && !!inquiryId,
    refetchInterval: open ? POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (
      threadQuery.isError &&
      axios.isAxiosError(threadQuery.error) &&
      threadQuery.error.response?.status === 404
    ) {
      clearStoredInquiryId();
      setInquiryId(null);
    }
  }, [threadQuery.isError, threadQuery.error]);

  const startForm = useForm<CreateInquiryFormInput>({
    resolver: zodResolver(createInquirySchema),
    // The chat widget has no topic selector of its own (that's a contact-page-
    // only field) — OTHER is submitted silently so this shared schema's now-
    // required `topic` doesn't block chat-started inquiries.
    defaultValues: {
      topic: InquiryTopic.OTHER,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      message: "",
    },
  });

  const startMutation = useMutation({
    mutationFn: (input: CreateInquiryFormInput) =>
      axios
        .post<{ inquiry: { id: string } }>("/api/storefront/inquiries", input)
        .then((res) => res.data.inquiry.id),
    onSuccess: (id) => {
      setStoredInquiryId(id);
      setInquiryId(id);
      startForm.reset();
    },
  });

  const replyForm = useForm<AddMessageFormInput>({
    resolver: zodResolver(addMessageSchema),
    defaultValues: { message: "" },
  });

  const replyMutation = useMutation({
    mutationFn: (input: AddMessageFormInput) =>
      axios
        .post(`/api/storefront/inquiries/${inquiryId}/messages`, input)
        .then((res) => res.data),
    onSuccess: () => {
      replyForm.reset();
      queryClient.invalidateQueries({ queryKey: ["inquiry-thread", inquiryId] });
    },
  });

  const thread = threadQuery.data;
  const isClosed = thread?.status === InquiryStatus.CLOSED;

  return (
    <div
      className={cn(
        "fixed bottom-4 end-4 z-50 flex-col items-end gap-3",
        open ? "flex" : "hidden min-[860px]:flex",
      )}
    >
      {open && (
        <div className="flex h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border/60 bg-background/85 shadow-xl backdrop-blur-xl reduced-transparency:bg-background reduced-transparency:backdrop-blur-none">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-semibold">{t("chat.title")}</p>
            <button
              type="button"
              aria-label={t("chat.close")}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {!inquiryId ? (
            <form
              noValidate
              onSubmit={startForm.handleSubmit((input) =>
                startMutation.mutate({
                  ...input,
                  language: (i18n.resolvedLanguage ?? "en") as Language,
                }),
              )}
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
              <p className="text-sm text-muted-foreground">{t("chat.startPrompt")}</p>
              <div className="grid gap-1.5">
                <Label htmlFor="chat-name">{t("chat.name")}</Label>
                <Input
                  id="chat-name"
                  autoComplete="name"
                  aria-invalid={!!startForm.formState.errors.customerName}
                  {...startForm.register("customerName")}
                />
                {startForm.formState.errors.customerName && (
                  <p className="text-sm text-destructive">
                    {startForm.formState.errors.customerName.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="chat-email">{t("chat.email")}</Label>
                <Input
                  id="chat-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!startForm.formState.errors.customerEmail}
                  {...startForm.register("customerEmail")}
                />
                {startForm.formState.errors.customerEmail && (
                  <p className="text-sm text-destructive">
                    {startForm.formState.errors.customerEmail.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="chat-phone">{t("chat.phone")}</Label>
                <Input
                  id="chat-phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!startForm.formState.errors.customerPhone}
                  {...startForm.register("customerPhone")}
                />
                {startForm.formState.errors.customerPhone && (
                  <p className="text-sm text-destructive">
                    {startForm.formState.errors.customerPhone.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="chat-message">{t("chat.message")}</Label>
                <Textarea
                  id="chat-message"
                  rows={3}
                  aria-invalid={!!startForm.formState.errors.message}
                  {...startForm.register("message")}
                />
                {startForm.formState.errors.message && (
                  <p className="text-sm text-destructive">
                    {startForm.formState.errors.message.message}
                  </p>
                )}
              </div>
              {startMutation.isError && (
                <p className="text-sm text-destructive">{t("chat.startError")}</p>
              )}
              <Button type="submit" disabled={startMutation.isPending}>
                {startMutation.isPending ? t("chat.starting") : t("chat.start")}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {thread?.messages.map((m) => (
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
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
              {isClosed ? (
                <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                  {t("chat.closed")}
                </p>
              ) : (
                <form
                  noValidate
                  onSubmit={replyForm.handleSubmit((input) => replyMutation.mutate(input))}
                  className="flex items-end gap-2 border-t p-3"
                >
                  <Textarea
                    aria-label={t("chat.message")}
                    rows={1}
                    className="min-h-9 flex-1 resize-none"
                    {...replyForm.register("message")}
                  />
                  <Button type="submit" size="icon" disabled={replyMutation.isPending}>
                    <Send className="size-4" />
                  </Button>
                </form>
              )}
              {replyForm.formState.errors.message && (
                <p className="px-4 pb-2 text-sm text-destructive">
                  {replyForm.formState.errors.message.message}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <Button
        type="button"
        size="icon"
        className="size-12 rounded-full shadow-lg"
        aria-label={open ? t("chat.close") : t("chat.open")}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send } from "lucide-react";
import {
  addMessageSchema,
  InquiryStatus,
  InquiryTopic,
  MessageSender,
  DraftStatus,
  Role,
  type AddMessageFormInput,
  type Language,
} from "@es-market/core";
import {
  canClaim,
  canClose,
  canEscalate,
  canReopen,
  canResolve,
  type InquiryRow,
} from "@/components/InquiriesTable";
import InquiryStatusBadge from "@/components/InquiryStatusBadge";
import SmsLogList from "@/components/SmsLogList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ThreadMessage = {
  id: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
  draftStatus: DraftStatus | null;
  sources: { id: string; title: string }[];
};

type InquiryThread = InquiryRow & { messages: ThreadMessage[]; language: Language };

type Agent = { id: string; name: string; role: Role };

function extractServerError(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && error.response?.data?.error
    ? String(error.response.data.error)
    : fallback;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function InquiryDetailPage() {
  const { t } = useTranslation();
  const LANGUAGE_LABELS: Record<Language, string> = {
    en: t("admin.inquiries.detail.languageLabels.en"),
    ar: t("admin.inquiries.detail.languageLabels.ar"),
    sw: t("admin.inquiries.detail.languageLabels.sw"),
    fr: t("admin.inquiries.detail.languageLabels.fr"),
  };
  const INQUIRY_TOPIC_LABELS: Record<InquiryTopic, string> = {
    [InquiryTopic.ORDER_ISSUE]: t("admin.inquiries.detail.topicLabels.ORDER_ISSUE"),
    [InquiryTopic.PRODUCT_QUESTION]: t("admin.inquiries.detail.topicLabels.PRODUCT_QUESTION"),
    [InquiryTopic.RETURNS_REFUND]: t("admin.inquiries.detail.topicLabels.RETURNS_REFUND"),
    [InquiryTopic.WHOLESALE_BULK]: t("admin.inquiries.detail.topicLabels.WHOLESALE_BULK"),
    [InquiryTopic.OTHER]: t("admin.inquiries.detail.topicLabels.OTHER"),
  };
  const DRAFT_STATUS_LABELS: Record<Exclude<DraftStatus, "PENDING">, string> = {
    SENT_UNEDITED: t("admin.inquiries.detail.sentAsIs"),
    SENT_EDITED: t("admin.inquiries.detail.sentWithEdits"),
    DISCARDED: t("admin.inquiries.detail.discardedStatus"),
    AUTO_RESOLVED: t("admin.inquiries.detail.autoResolvedStatus"),
  };
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  const { data: inquiry, isPending, error } = useQuery({
    queryKey: ["inquiries", id],
    queryFn: () =>
      axios
        .get<{ inquiry: InquiryThread }>(`/api/inquiries/${id}`)
        .then((res) => res.data.inquiry),
  });

  const { data: agents } = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      axios.get<{ users: Agent[] }>("/api/users").then((res) => res.data.users),
  });

  // Partial matching (the default) already covers both this detail query
  // (["inquiries", id]) and the list page's query (["inquiries", queue, status]).
  const invalidateInquiry = () => queryClient.invalidateQueries({ queryKey: ["inquiries"] });

  const claimMutation = useMutation({
    mutationFn: () => axios.post(`/api/inquiries/${id}/claim`),
    onSuccess: invalidateInquiry,
  });
  const resolveMutation = useMutation({
    mutationFn: () => axios.post(`/api/inquiries/${id}/resolve`),
    onSuccess: invalidateInquiry,
  });
  const closeMutation = useMutation({
    mutationFn: () => axios.post(`/api/inquiries/${id}/close`),
    onSuccess: invalidateInquiry,
  });
  const reopenMutation = useMutation({
    mutationFn: () => axios.post(`/api/inquiries/${id}/reopen`),
    onSuccess: invalidateInquiry,
  });
  const assignMutation = useMutation({
    mutationFn: (agentId: string) =>
      axios.post(`/api/inquiries/${id}/assign`, { agentId }),
    onSuccess: invalidateInquiry,
  });
  const escalateMutation = useMutation({
    mutationFn: (agentId: string) =>
      axios.post(`/api/inquiries/${id}/escalate`, { agentId }),
    onSuccess: invalidateInquiry,
  });
  const approveDraftMutation = useMutation({
    mutationFn: ({ messageId, message }: { messageId: string; message: string }) =>
      axios.post(`/api/inquiries/${id}/messages/${messageId}/approve`, { message }),
    onSuccess: invalidateInquiry,
  });
  const discardDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      axios.post(`/api/inquiries/${id}/messages/${messageId}/discard`),
    onSuccess: invalidateInquiry,
  });

  const replyForm = useForm<AddMessageFormInput>({
    resolver: zodResolver(addMessageSchema),
    defaultValues: { message: "" },
  });
  const replyMutation = useMutation({
    mutationFn: (input: AddMessageFormInput) =>
      axios.post(`/api/inquiries/${id}/messages`, input),
    onSuccess: () => {
      replyForm.reset();
      invalidateInquiry();
    },
  });

  const actionsPending =
    claimMutation.isPending ||
    resolveMutation.isPending ||
    closeMutation.isPending ||
    reopenMutation.isPending ||
    assignMutation.isPending ||
    escalateMutation.isPending;

  const serverError = claimMutation.isError
    ? extractServerError(claimMutation.error, t("admin.inquiries.claimError"))
    : resolveMutation.isError
      ? extractServerError(resolveMutation.error, t("admin.inquiries.resolveError"))
      : closeMutation.isError
        ? extractServerError(closeMutation.error, t("admin.inquiries.closeError"))
        : reopenMutation.isError
          ? extractServerError(reopenMutation.error, t("admin.inquiries.reopenError"))
          : assignMutation.isError
            ? extractServerError(assignMutation.error, t("admin.inquiries.detail.assignError"))
            : escalateMutation.isError
              ? extractServerError(escalateMutation.error, t("admin.inquiries.detail.escalateError"))
              : approveDraftMutation.isError
                ? extractServerError(approveDraftMutation.error, t("admin.inquiries.detail.approveError"))
                : discardDraftMutation.isError
                  ? extractServerError(discardDraftMutation.error, t("admin.inquiries.detail.discardError"))
                  : null;

  const notFound = isAxiosError(error) && error.response?.status === 404;
  const isClosed = inquiry?.status === InquiryStatus.CLOSED;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/admin/inquiries"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("admin.inquiries.detail.backToInquiries")}
      </Link>
      {isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ) : notFound ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("admin.inquiries.detail.notFound")}
        </p>
      ) : error || !inquiry ? (
        <p className="py-8 text-center text-sm text-destructive">
          {t("admin.inquiries.detail.loadError")}
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {inquiry.customerName}
              <InquiryStatusBadge status={inquiry.status} />
              <Badge variant="outline">{LANGUAGE_LABELS[inquiry.language]}</Badge>
              {inquiry.autoResolvedAt !== null && (
                <Badge variant="outline">
                  {t("admin.inquiries.detail.autoResolved", {
                    date: new Date(inquiry.autoResolvedAt).toLocaleString(),
                  })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t("admin.inquiries.detail.receivedOn", {
                date: new Date(inquiry.createdAt).toLocaleString(),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="divide-y">
              <DetailRow
                label={t("admin.inquiries.detail.email")}
                value={inquiry.customerEmail ?? t("admin.orders.detail.notFoundValue")}
              />
              <DetailRow
                label={t("admin.inquiries.detail.phone")}
                value={inquiry.customerPhone ?? t("admin.orders.detail.notFoundValue")}
              />
              <DetailRow
                label={t("admin.inquiries.detail.topic")}
                value={
                  inquiry.topic
                    ? INQUIRY_TOPIC_LABELS[inquiry.topic as InquiryTopic]
                    : t("admin.orders.detail.notFoundValue")
                }
              />
              <DetailRow
                label={t("admin.orders.detail.updated")}
                value={new Date(inquiry.updatedAt).toLocaleString()}
              />
            </dl>

            <div className="grid gap-1.5">
              <label htmlFor="inquiry-assign" className="text-sm font-medium">
                {t("admin.inquiries.table.assignedTo")}
              </label>
              <Select
                value={inquiry.assignedAgent?.id ?? "unassigned"}
                onValueChange={(value) =>
                  assignMutation.mutate(!value || value === "unassigned" ? "" : value)
                }
              >
                <SelectTrigger id="inquiry-assign" className="w-full">
                  <SelectValue placeholder={t("admin.inquiries.table.unassigned")}>
                    {(value: string) =>
                      agents?.find((agent) => agent.id === value)?.name ??
                      t("admin.inquiries.table.unassigned")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t("admin.inquiries.table.unassigned")}</SelectItem>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(inquiry.escalatedAt !== null || canEscalate(inquiry)) && (
              <div className="grid gap-1.5">
                <label htmlFor="inquiry-escalate" className="text-sm font-medium">
                  {t("admin.inquiries.detail.escalateTo")}
                </label>
                {inquiry.escalatedAt !== null ? (
                  <Badge variant="destructive" className="w-fit">
                    {t("admin.inquiries.detail.escalatedBadge")}{" "}
                    {new Date(inquiry.escalatedAt).toLocaleString()}
                  </Badge>
                ) : (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      // No "unassigned"/clear option here (escalation always
                      // hands off to a specific admin) — a null value has no
                      // meaningful action to take.
                      if (value) escalateMutation.mutate(value);
                    }}
                  >
                    <SelectTrigger id="inquiry-escalate" className="w-full">
                      <SelectValue placeholder={t("admin.inquiries.detail.escalatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        ?.filter((agent) => agent.role === Role.ADMIN)
                        .map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {inquiry.smsLogs && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("admin.inquiries.detail.smsLog")}</h3>
                <SmsLogList logs={inquiry.smsLogs} />
              </div>
            )}

            <div className="space-y-3 rounded-lg border p-4">
              {inquiry.messages.map((message) =>
                message.sender === MessageSender.AI_DRAFT ? (
                  <div key={message.id} className="max-w-full rounded-lg border border-dashed p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="outline">{t("admin.inquiries.detail.aiDraft")}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {message.sources.length > 0 && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t("admin.inquiries.detail.sourcesPrefix", {
                          titles: message.sources.map((source) => source.title).join(", "),
                        })}
                      </p>
                    )}
                    {message.draftStatus === DraftStatus.PENDING && !isClosed ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={3}
                          dir={inquiry.language === "ar" ? "rtl" : "ltr"}
                          lang={inquiry.language}
                          aria-label={t("admin.inquiries.detail.draftReplyAria")}
                          value={draftEdits[message.id] ?? message.body}
                          onChange={(event) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [message.id]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={approveDraftMutation.isPending || discardDraftMutation.isPending}
                            onClick={() =>
                              approveDraftMutation.mutate({
                                messageId: message.id,
                                message: draftEdits[message.id] ?? message.body,
                              })
                            }
                          >
                            {t("admin.inquiries.detail.approveAndSend")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approveDraftMutation.isPending || discardDraftMutation.isPending}
                            onClick={() => discardDraftMutation.mutate(message.id)}
                          >
                            {t("admin.inquiries.detail.discard")}
                          </Button>
                        </div>
                      </div>
                    ) : message.draftStatus === DraftStatus.PENDING ? (
                      // Closed with the draft never reviewed — approve/discard would
                      // both now 409 server-side, so just show it as unreviewed history.
                      <div className="text-muted-foreground">
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-[10px]">
                          {t("admin.inquiries.detail.notReviewedClosed")}
                        </p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-[10px]">
                          {message.draftStatus && DRAFT_STATUS_LABELS[message.draftStatus as Exclude<DraftStatus, "PENDING">]}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className={
                      message.sender === MessageSender.STAFF
                        ? "ms-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "me-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                    }
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {message.author
                        ? t("admin.inquiries.detail.authorLine", {
                            name: message.author.name,
                            date: new Date(message.createdAt).toLocaleString(),
                          })
                        : new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                ),
              )}
            </div>

            {isClosed ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.inquiries.detail.closedNote")}
              </p>
            ) : (
              <form
                noValidate
                onSubmit={replyForm.handleSubmit((input) => replyMutation.mutate(input))}
                className="grid gap-1.5"
              >
                <label htmlFor="inquiry-reply" className="text-sm font-medium">
                  {t("admin.inquiries.detail.replyLabel")}
                </label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.inquiries.detail.customerWroteIn", {
                    language: LANGUAGE_LABELS[inquiry.language],
                  })}
                </p>
                <div className="flex items-end gap-2">
                  <Textarea
                    id="inquiry-reply"
                    rows={2}
                    dir={inquiry.language === "ar" ? "rtl" : "ltr"}
                    lang={inquiry.language}
                    aria-invalid={!!replyForm.formState.errors.message}
                    {...replyForm.register("message")}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t("admin.inquiries.detail.sendReplyAria")}
                    disabled={replyMutation.isPending}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                {replyForm.formState.errors.message && (
                  <p className="text-sm text-destructive">
                    {replyForm.formState.errors.message.message}
                  </p>
                )}
              </form>
            )}

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex flex-wrap gap-2">
              {canClaim(inquiry) && (
                <Button disabled={actionsPending} onClick={() => claimMutation.mutate()}>
                  {t("admin.inquiries.table.claim")}
                </Button>
              )}
              {canResolve(inquiry) && (
                <Button
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => resolveMutation.mutate()}
                >
                  {t("admin.inquiries.table.resolve")}
                </Button>
              )}
              {canClose(inquiry) && (
                <Button
                  variant="destructive"
                  disabled={actionsPending}
                  onClick={() => closeMutation.mutate()}
                >
                  {t("admin.inquiries.table.close")}
                </Button>
              )}
              {canReopen(inquiry) && (
                <Button
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => reopenMutation.mutate()}
                >
                  {t("admin.inquiries.table.reopen")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Send } from "lucide-react";
import {
  addMessageSchema,
  InquiryStatus,
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

const DRAFT_STATUS_LABELS: Record<Exclude<DraftStatus, "PENDING">, string> = {
  SENT_UNEDITED: "Sent as-is",
  SENT_EDITED: "Sent with edits",
  DISCARDED: "Discarded",
  AUTO_RESOLVED: "Auto-resolved by AI",
};

type InquiryThread = InquiryRow & { messages: ThreadMessage[]; language: Language };

type Agent = { id: string; name: string; role: Role };

// English glosses for staff, distinct from LanguageSwitcher.tsx's customer-facing
// endonyms (which show each language in itself) — staff need to recognize the
// language name, not read it.
const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ar: "Arabic",
  sw: "Swahili",
  fr: "French",
};

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
    ? extractServerError(claimMutation.error, "Could not claim the inquiry. Please try again.")
    : resolveMutation.isError
      ? extractServerError(resolveMutation.error, "Could not resolve the inquiry. Please try again.")
      : closeMutation.isError
        ? extractServerError(closeMutation.error, "Could not close the inquiry. Please try again.")
        : reopenMutation.isError
          ? extractServerError(reopenMutation.error, "Could not reopen the inquiry. Please try again.")
          : assignMutation.isError
            ? extractServerError(assignMutation.error, "Could not assign the inquiry. Please try again.")
            : escalateMutation.isError
              ? extractServerError(escalateMutation.error, "Could not escalate the inquiry. Please try again.")
              : approveDraftMutation.isError
                ? extractServerError(approveDraftMutation.error, "Could not send the draft. Please try again.")
                : discardDraftMutation.isError
                  ? extractServerError(discardDraftMutation.error, "Could not discard the draft. Please try again.")
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
        Back to inquiries
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
        <p className="py-8 text-center text-sm text-muted-foreground">Inquiry not found.</p>
      ) : error || !inquiry ? (
        <p className="py-8 text-center text-sm text-destructive">
          Could not load the inquiry. Please try again.
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
                  Auto-resolved {new Date(inquiry.autoResolvedAt).toLocaleString()}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Received {new Date(inquiry.createdAt).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="divide-y">
              <DetailRow label="Email" value={inquiry.customerEmail} />
              <DetailRow label="Phone" value={inquiry.customerPhone ?? "—"} />
              <DetailRow label="Updated" value={new Date(inquiry.updatedAt).toLocaleString()} />
            </dl>

            <div className="grid gap-1.5">
              <label htmlFor="inquiry-assign" className="text-sm font-medium">
                Assigned to
              </label>
              <Select
                value={inquiry.assignedAgent?.id ?? "unassigned"}
                onValueChange={(value) =>
                  assignMutation.mutate(value === "unassigned" ? "" : value)
                }
              >
                <SelectTrigger id="inquiry-assign" className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(value: string) =>
                      agents?.find((agent) => agent.id === value)?.name ?? "Unassigned"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
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
                  Escalation
                </label>
                {inquiry.escalatedAt !== null ? (
                  <Badge variant="destructive" className="w-fit">
                    Escalated {new Date(inquiry.escalatedAt).toLocaleString()}
                  </Badge>
                ) : (
                  <Select value="" onValueChange={(value) => escalateMutation.mutate(value)}>
                    <SelectTrigger id="inquiry-escalate" className="w-full">
                      <SelectValue placeholder="Escalate to admin…" />
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

            <div className="space-y-3 rounded-lg border p-4">
              {inquiry.messages.map((message) =>
                message.sender === MessageSender.AI_DRAFT ? (
                  <div key={message.id} className="max-w-full rounded-lg border border-dashed p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="outline">AI draft</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {message.sources.length > 0 && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Sources: {message.sources.map((source) => source.title).join(", ")}
                      </p>
                    )}
                    {message.draftStatus === DraftStatus.PENDING && !isClosed ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={3}
                          dir={inquiry.language === "ar" ? "rtl" : "ltr"}
                          lang={inquiry.language}
                          aria-label="Draft reply"
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
                            Approve &amp; send
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approveDraftMutation.isPending || discardDraftMutation.isPending}
                            onClick={() => discardDraftMutation.mutate(message.id)}
                          >
                            Discard
                          </Button>
                        </div>
                      </div>
                    ) : message.draftStatus === DraftStatus.PENDING ? (
                      // Closed with the draft never reviewed — approve/discard would
                      // both now 409 server-side, so just show it as unreviewed history.
                      <div className="text-muted-foreground">
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-[10px]">Not reviewed — conversation closed</p>
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
                      {message.author ? `${message.author.name} — ` : ""}
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                ),
              )}
            </div>

            {isClosed ? (
              <p className="text-sm text-muted-foreground">This conversation is closed.</p>
            ) : (
              <form
                noValidate
                onSubmit={replyForm.handleSubmit((input) => replyMutation.mutate(input))}
                className="grid gap-1.5"
              >
                <label htmlFor="inquiry-reply" className="text-sm font-medium">
                  Reply
                </label>
                <p className="text-sm text-muted-foreground">
                  Customer wrote in {LANGUAGE_LABELS[inquiry.language]} — reply in the same
                  language.
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
                    aria-label="Send reply"
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
                  Claim
                </Button>
              )}
              {canResolve(inquiry) && (
                <Button
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => resolveMutation.mutate()}
                >
                  Resolve
                </Button>
              )}
              {canClose(inquiry) && (
                <Button
                  variant="destructive"
                  disabled={actionsPending}
                  onClick={() => closeMutation.mutate()}
                >
                  Close
                </Button>
              )}
              {canReopen(inquiry) && (
                <Button
                  variant="outline"
                  disabled={actionsPending}
                  onClick={() => reopenMutation.mutate()}
                >
                  Reopen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

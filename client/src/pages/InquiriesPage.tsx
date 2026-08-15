import { useState } from "react";
import { useSearchParams } from "react-router";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { INQUIRY_STATUSES, type InquiryQueue, type InquiryStatus } from "@es-market/core";
import InquiriesTable, { type InquiryRow } from "@/components/InquiriesTable";
import { getInquiryStatusLabel } from "@/components/InquiryStatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const QUEUE_VALUES: InquiryQueue[] = ["mine", "unassigned", "all"];

function extractServerError(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && error.response?.data?.error
    ? String(error.response.data.error)
    : fallback;
}

export default function InquiriesPage() {
  const { t } = useTranslation();
  const QUEUE_LABELS: Record<InquiryQueue, string> = {
    mine: t("admin.inquiries.queueMine"),
    unassigned: t("admin.inquiries.queueUnassigned"),
    all: t("admin.inquiries.queueAll"),
  };
  const queryClient = useQueryClient();
  // Read-once (like the storefront's own ?tag= deep-link pattern), not
  // two-way synced — lets a dashboard KPI card land here pre-filtered
  // without every later Tabs/Select change round-tripping through the URL.
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState<InquiryQueue>(() => {
    const fromUrl = searchParams.get("queue");
    return fromUrl && (QUEUE_VALUES as readonly string[]).includes(fromUrl)
      ? (fromUrl as InquiryQueue)
      : "all";
  });
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && (INQUIRY_STATUSES as readonly string[]).includes(fromUrl)
      ? (fromUrl as InquiryStatus)
      : "all";
  });

  const { data, isError } = useQuery({
    queryKey: ["inquiries", queue, statusFilter],
    queryFn: () =>
      axios
        .get<{ inquiries: InquiryRow[] }>("/api/inquiries", {
          params: { queue, ...(statusFilter === "all" ? {} : { status: statusFilter }) },
        })
        .then((res) => res.data.inquiries),
  });
  const inquiries = data ?? null;

  const invalidateInquiries = () =>
    queryClient.invalidateQueries({ queryKey: ["inquiries"] });

  const claimMutation = useMutation({
    mutationFn: (inquiry: InquiryRow) => axios.post(`/api/inquiries/${inquiry.id}/claim`),
    onSuccess: invalidateInquiries,
  });
  const resolveMutation = useMutation({
    mutationFn: (inquiry: InquiryRow) => axios.post(`/api/inquiries/${inquiry.id}/resolve`),
    onSuccess: invalidateInquiries,
  });
  const closeMutation = useMutation({
    mutationFn: (inquiry: InquiryRow) => axios.post(`/api/inquiries/${inquiry.id}/close`),
    onSuccess: invalidateInquiries,
  });
  const reopenMutation = useMutation({
    mutationFn: (inquiry: InquiryRow) => axios.post(`/api/inquiries/${inquiry.id}/reopen`),
    onSuccess: invalidateInquiries,
  });

  const serverError = claimMutation.isError
    ? extractServerError(claimMutation.error, t("admin.inquiries.claimError"))
    : resolveMutation.isError
      ? extractServerError(resolveMutation.error, t("admin.inquiries.resolveError"))
      : closeMutation.isError
        ? extractServerError(closeMutation.error, t("admin.inquiries.closeError"))
        : reopenMutation.isError
          ? extractServerError(reopenMutation.error, t("admin.inquiries.reopenError"))
          : null;

  const actionsPending =
    claimMutation.isPending ||
    resolveMutation.isPending ||
    closeMutation.isPending ||
    reopenMutation.isPending;

  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader>
        <CardTitle>{t("admin.inquiries.title")}</CardTitle>
        <CardDescription>
          {inquiries
            ? t("admin.inquiries.subtitleCount", { count: inquiries.length })
            : t("admin.inquiries.subtitleFallback")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={queue} onValueChange={(value) => setQueue(value as InquiryQueue)}>
            <TabsList>
              {QUEUE_VALUES.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {QUEUE_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as InquiryStatus | "all")}
          >
            <SelectTrigger className="w-40" aria-label={t("admin.inquiries.statusLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.inquiries.allStatuses")}</SelectItem>
              {INQUIRY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {getInquiryStatusLabel(t, status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.inquiries.loadError")}
          </p>
        ) : (
          <>
            {serverError && <p className="mb-3 text-sm text-destructive">{serverError}</p>}
            <InquiriesTable
              inquiries={inquiries}
              onClaim={(inquiry) => claimMutation.mutate(inquiry)}
              onResolve={(inquiry) => resolveMutation.mutate(inquiry)}
              onClose={(inquiry) => closeMutation.mutate(inquiry)}
              onReopen={(inquiry) => reopenMutation.mutate(inquiry)}
              actionsPending={actionsPending}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

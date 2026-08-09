import { useState } from "react";
import { useSearchParams } from "react-router";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { INQUIRY_STATUSES, type InquiryQueue, type InquiryStatus } from "@es-market/core";
import InquiriesTable, { type InquiryRow } from "@/components/InquiriesTable";
import { INQUIRY_STATUS_LABELS } from "@/components/InquiryStatusBadge";
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

const QUEUE_LABELS: Record<InquiryQueue, string> = {
  mine: "My queue",
  unassigned: "Unassigned",
  all: "All",
};

function extractServerError(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && error.response?.data?.error
    ? String(error.response.data.error)
    : fallback;
}

export default function InquiriesPage() {
  const queryClient = useQueryClient();
  // Read-once (like the storefront's own ?tag= deep-link pattern), not
  // two-way synced — lets a dashboard KPI card land here pre-filtered
  // without every later Tabs/Select change round-tripping through the URL.
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState<InquiryQueue>(() => {
    const fromUrl = searchParams.get("queue");
    return fromUrl && fromUrl in QUEUE_LABELS ? (fromUrl as InquiryQueue) : "all";
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
    ? extractServerError(claimMutation.error, "Could not claim the inquiry. Please try again.")
    : resolveMutation.isError
      ? extractServerError(resolveMutation.error, "Could not resolve the inquiry. Please try again.")
      : closeMutation.isError
        ? extractServerError(closeMutation.error, "Could not close the inquiry. Please try again.")
        : reopenMutation.isError
          ? extractServerError(reopenMutation.error, "Could not reopen the inquiry. Please try again.")
          : null;

  const actionsPending =
    claimMutation.isPending ||
    resolveMutation.isPending ||
    closeMutation.isPending ||
    reopenMutation.isPending;

  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader>
        <CardTitle>Inquiries</CardTitle>
        <CardDescription>
          {inquiries
            ? `${inquiries.length} inquir${inquiries.length === 1 ? "y" : "ies"}`
            : "Customer support inquiries"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={queue} onValueChange={(value) => setQueue(value as InquiryQueue)}>
            <TabsList>
              {(["mine", "unassigned", "all"] as const).map((value) => (
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
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {INQUIRY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {INQUIRY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load inquiries. Please try again.
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

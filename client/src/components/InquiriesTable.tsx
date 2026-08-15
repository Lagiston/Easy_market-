import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, RotateCcw, TriangleAlert, UserPlus } from "lucide-react";
import { InquiryStatus, type InquiryChannel } from "@es-market/core";
import InquiryStatusBadge from "@/components/InquiryStatusBadge";
import type { SmsLogRow } from "@/components/SmsLogList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InquiryRow = {
  id: string;
  channel: InquiryChannel;
  status: InquiryStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  topic: string | null;
  assignedAgent: { id: string; name: string } | null;
  escalatedAt: string | null;
  autoResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Only present on the single-inquiry detail fetch (GET /inquiries/:id),
  // not the list route — optional so the same InquiryRow type still fits
  // list rows.
  smsLogs?: SmsLogRow[];
};

export function canClaim(inquiry: InquiryRow) {
  return inquiry.assignedAgent === null;
}

export function canEscalate(inquiry: InquiryRow) {
  return inquiry.escalatedAt === null && inquiry.status !== InquiryStatus.CLOSED;
}

export function canResolve(inquiry: InquiryRow) {
  return inquiry.status === InquiryStatus.OPEN;
}

export function canClose(inquiry: InquiryRow) {
  return inquiry.status === InquiryStatus.OPEN || inquiry.status === InquiryStatus.RESOLVED;
}

export function canReopen(inquiry: InquiryRow) {
  return inquiry.status === InquiryStatus.RESOLVED || inquiry.status === InquiryStatus.CLOSED;
}

export default function InquiriesTable({
  inquiries,
  onClaim,
  onResolve,
  onClose,
  onReopen,
  actionsPending,
}: {
  inquiries: InquiryRow[] | null;
  onClaim: (inquiry: InquiryRow) => void;
  onResolve: (inquiry: InquiryRow) => void;
  onClose: (inquiry: InquiryRow) => void;
  onReopen: (inquiry: InquiryRow) => void;
  actionsPending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.inquiries.table.customer")}</TableHead>
          <TableHead>{t("admin.inquiries.table.status")}</TableHead>
          <TableHead>{t("admin.inquiries.table.assignedTo")}</TableHead>
          <TableHead>{t("admin.inquiries.table.updated")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("admin.inquiries.table.actionsSr")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {inquiries === null ? (
          Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }, (_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-3 w-16" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : inquiries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              {t("admin.inquiries.table.empty")}
            </TableCell>
          </TableRow>
        ) : (
          inquiries.map((inquiry) => (
            <TableRow key={inquiry.id}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/admin/inquiries/${inquiry.id}`}
                    className="font-medium hover:underline"
                  >
                    {inquiry.customerName}
                  </Link>
                  {inquiry.escalatedAt !== null && (
                    <TriangleAlert
                      role="img"
                      aria-label={t("admin.inquiries.table.escalated")}
                      className="size-3.5 text-destructive"
                    />
                  )}
                </div>
                <div className="text-muted-foreground">
                  {inquiry.customerEmail ?? t("admin.inquiries.table.noEmail")}
                </div>
              </TableCell>
              <TableCell>
                <InquiryStatusBadge status={inquiry.status} />
              </TableCell>
              <TableCell>
                {inquiry.assignedAgent?.name ?? t("admin.inquiries.table.unassigned")}
              </TableCell>
              <TableCell>{new Date(inquiry.updatedAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {canClaim(inquiry) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.inquiries.table.claimAria", { name: inquiry.customerName })}
                      disabled={actionsPending}
                      onClick={() => onClaim(inquiry)}
                    >
                      <UserPlus />
                    </Button>
                  )}
                  {canResolve(inquiry) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.inquiries.table.resolveAria", { name: inquiry.customerName })}
                      disabled={actionsPending}
                      onClick={() => onResolve(inquiry)}
                    >
                      <CheckCircle2 />
                    </Button>
                  )}
                  {canClose(inquiry) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={t("admin.inquiries.table.closeAria", { name: inquiry.customerName })}
                      disabled={actionsPending}
                      onClick={() => onClose(inquiry)}
                    >
                      <Ban />
                    </Button>
                  )}
                  {canReopen(inquiry) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.inquiries.table.reopenAria", { name: inquiry.customerName })}
                      disabled={actionsPending}
                      onClick={() => onReopen(inquiry)}
                    >
                      <RotateCcw />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

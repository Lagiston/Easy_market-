import { useTranslation } from "react-i18next";
import { SmsLogStatus } from "@es-market/core";
import { formatRelativeAge } from "@/lib/relative-time";
import { Badge } from "@/components/ui/badge";

export type SmsLogRow = {
  id: string;
  to: string;
  message: string;
  status: SmsLogStatus;
  error: string | null;
  createdAt: string;
};

// SKIPPED (no provider configured) reads as neutral, not a failure — it's
// an environment state, not something that went wrong with a real send.
const STATUS_TONE_CLASS: Record<SmsLogStatus, string> = {
  [SmsLogStatus.SENT]: "border-emerald-500/30 bg-emerald-500/[0.14] text-emerald-700 dark:text-emerald-400",
  [SmsLogStatus.FAILED]: "border-red-500/30 bg-red-500/[0.14] text-red-700 dark:text-red-400",
  [SmsLogStatus.SKIPPED]: "border-border bg-muted text-muted-foreground",
};

// Shared by OrderDetailPage.tsx and InquiryDetailPage.tsx — both entities'
// staff detail routes now include a smsLogs array (most-recent-first) so
// staff can see whether a customer was actually notified, since every
// order-status/inquiry-reply SMS is fire-and-forget from the caller's side.
export default function SmsLogList({ logs }: { logs: SmsLogRow[] }) {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<SmsLogStatus, string> = {
    [SmsLogStatus.SENT]: t("admin.smsLog.statusSent"),
    [SmsLogStatus.FAILED]: t("admin.smsLog.statusFailed"),
    [SmsLogStatus.SKIPPED]: t("admin.smsLog.statusSkipped"),
  };
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("admin.smsLog.empty")}</p>;
  }
  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate text-muted-foreground" title={log.message}>
              {log.message}
            </p>
            {log.status === SmsLogStatus.FAILED && log.error && (
              <p className="truncate text-xs text-destructive" title={log.error}>
                {log.error}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge className={STATUS_TONE_CLASS[log.status]} title={STATUS_LABEL[log.status]}>
              {STATUS_LABEL[log.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatRelativeAge(log.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

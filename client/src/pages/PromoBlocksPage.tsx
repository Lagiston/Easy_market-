import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import CreatePromoBlockDialog from "./CreatePromoBlockDialog";
import EditPromoBlockDialog from "./EditPromoBlockDialog";
import DeletePromoBlockDialog from "./DeletePromoBlockDialog";
import PromoBlocksTable, { type PromoBlockRow } from "@/components/PromoBlocksTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PromoBlocksPage() {
  const { t } = useTranslation();
  const [editingPromoBlock, setEditingPromoBlock] = useState<PromoBlockRow | null>(null);
  const [deletingPromoBlock, setDeletingPromoBlock] = useState<PromoBlockRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["promo-blocks"],
    queryFn: () =>
      axios
        .get<{ promoBlocks: PromoBlockRow[] }>("/api/promo-blocks")
        .then((res) => res.data.promoBlocks),
  });
  const promoBlocks = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("admin.promoBlocks.title")}</CardTitle>
          <CardDescription>
            {promoBlocks
              ? t("admin.promoBlocks.subtitleCount", { count: promoBlocks.length })
              : t("admin.promoBlocks.subtitleFallback")}
          </CardDescription>
        </div>
        <CreatePromoBlockDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.promoBlocks.loadError")}
          </p>
        ) : (
          <PromoBlocksTable
            promoBlocks={promoBlocks}
            onEdit={setEditingPromoBlock}
            onDelete={setDeletingPromoBlock}
          />
        )}
        <EditPromoBlockDialog
          promoBlock={editingPromoBlock}
          onOpenChange={(open) => {
            if (!open) setEditingPromoBlock(null);
          }}
        />
        <DeletePromoBlockDialog
          promoBlock={deletingPromoBlock}
          onOpenChange={(open) => {
            if (!open) setDeletingPromoBlock(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
